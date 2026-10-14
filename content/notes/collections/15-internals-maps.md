# Internals II: HashMap & TreeMap

> **Level:** Hard · **Part 15 of 16** in Java Collections
>
> **In one line:** build a working hash map (chaining + power-of-two resize split, just like Java 8) and a working balanced tree map (left-leaning red-black tree) with an extra trick Java's `TreeMap` lacks: "how many keys are smaller than x" in O(log n).

---

## 1. A hash map with separate chaining

```java
import java.util.*;

public class MyHashMap<K, V> {
    private static final class Node<K, V> {
        final int hash;
        final K key;
        V value;
        Node<K, V> next;
        Node(int hash, K key, V value, Node<K, V> next) {
            this.hash = hash; this.key = key; this.value = value; this.next = next;
        }
    }

    private Node<K, V>[] table = newTable(16);    // capacity is always a power of two
    private int size;

    @SuppressWarnings("unchecked")
    private static <K, V> Node<K, V>[] newTable(int n) { return (Node<K, V>[]) new Node[n]; }

    private static int hash(Object key) {
        int h;
        return key == null ? 0 : (h = key.hashCode()) ^ (h >>> 16);   // fold high bits into low bits
    }

    public V get(Object key) {
        int h = hash(key);
        for (Node<K, V> e = table[h & (table.length - 1)]; e != null; e = e.next)
            if (e.hash == h && Objects.equals(e.key, key)) return e.value;   // cheap int check first
        return null;
    }

    public V put(K key, V value) {
        int h = hash(key), i = h & (table.length - 1);
        for (Node<K, V> e = table[i]; e != null; e = e.next) {
            if (e.hash == h && Objects.equals(e.key, key)) {             // existing key: replace
                V old = e.value;
                e.value = value;
                return old;
            }
        }
        table[i] = new Node<>(h, key, value, table[i]);   // prepend (Java 8 appends at the tail)
        if (++size > table.length * 3 / 4) resize();     // load factor 0.75
        return null;
    }

    public V remove(Object key) {
        int h = hash(key), i = h & (table.length - 1);
        Node<K, V> prev = null;
        for (Node<K, V> e = table[i]; e != null; prev = e, e = e.next) {
            if (e.hash == h && Objects.equals(e.key, key)) {
                if (prev == null) table[i] = e.next; else prev.next = e.next;   // unlink
                size--;
                return e.value;
            }
        }
        return null;
    }

    public int size() { return size; }

    private void resize() {
        Node<K, V>[] old = table;
        int oldCap = old.length;
        table = newTable(oldCap * 2);
        for (int j = 0; j < oldCap; j++) {
            Node<K, V> loHead = null, loTail = null, hiHead = null, hiTail = null;
            Node<K, V> e = old[j];
            while (e != null) {
                Node<K, V> next = e.next;
                e.next = null;
                if ((e.hash & oldCap) == 0) {              // the one new bit is 0: stays at j
                    if (loTail == null) loHead = e; else loTail.next = e;
                    loTail = e;
                } else {                                   // the new bit is 1: moves to j + oldCap
                    if (hiTail == null) hiHead = e; else hiTail.next = e;
                    hiTail = e;
                }
                e = next;
            }
            table[j] = loHead;
            table[j + oldCap] = hiHead;
        }
    }
}
```

### Why one bit decides where a node goes after resizing

The index is `hash & (cap - 1)`. Doubling the capacity adds **one more bit** to the mask:

```
old cap 16:  hash & 0b01111
new cap 32:  hash & 0b11111  =  (hash & 0b01111) + (hash & 0b10000)
                                  old index          0 or 16
```

So every node either stays at `j` or moves to `j + 16`. No hash is recomputed, no `equals` is called, and the order inside each chain is preserved.

### What the real HashMap adds on top

| Feature | Why |
|---|---|
| Lazy table creation | `new HashMap<>()` costs nothing until the first `put` |
| **Tail** insertion (Java 8+) | Java 7 inserted at the head, which reversed chains on resize; two threads resizing at once could create a **cycle** and spin forever in `get`. Tail insertion keeps order (HashMap is still not thread-safe; use `ConcurrentHashMap`). |
| **Treeify** at 8 nodes per bucket | a bucket becomes a red-black tree ordered by hash, then `compareTo` if the keys are `Comparable`: worst case O(log n) instead of O(n) |
| Untreeify at 6 | small trees go back to lists (lists are faster when tiny); 6 vs 8 avoids flipping back and forth |
| Resize instead of treeify below 64 slots | in a small table, collisions usually mean "table too small", not "bad hashes" |
| `modCount` | fail-fast iterators |

**Why 8?** With a decent hash and load factor 0.75, bucket sizes follow a Poisson distribution with mean about 0.5. The chance of a bucket holding 8 entries is about **0.00000006**. Treeifying only happens when hashes are genuinely bad, or when someone is *attacking* you with crafted keys (hash flooding, a real denial-of-service technique), and then the tree caps the damage at O(log n).

`LinkedHashMap` reuses all of this and only overrides three hooks (`afterNodeAccess`, `afterNodeInsertion`, `afterNodeRemoval`) to maintain its linked list: see [LinkedHashMap & LRU](/notes/coll-linkedhashmap).

### Open addressing, the other design

Instead of chains, store entries directly in the array and, on a collision, try the next slot (`i+1, i+2, …`: *linear probing*). It's more cache-friendly and used by Python's `dict` and many fast primitive maps. Deletion needs "tombstones" so searches don't stop early. Java's `HashMap` uses chaining; `IdentityHashMap` uses linear probing.

---

## 2. A balanced tree map: left-leaning red-black tree (with rank)

Java's `TreeMap` is a classic red-black tree with parent pointers and ~10 fix-up cases. The **left-leaning red-black tree** (Sedgewick) gives the same O(log n) guarantee with three one-line fix-ups. This version also stores the **subtree size** in every node, which gives `rank` ("how many keys < x") and `select` ("k-th smallest") in O(log n): something `java.util.TreeMap` cannot do (its `headMap(x).size()` is O(k)).

```java
public class RankedTreeMap<K extends Comparable<K>, V> {
    private static final boolean RED = true, BLACK = false;

    private final class Node {
        K key; V val;
        Node left, right;
        boolean color = RED;   // a new node is always red: it "joins" its parent
        int n = 1;             // number of nodes in this subtree
        Node(K key, V val) { this.key = key; this.val = val; }
    }

    private Node root;

    private boolean isRed(Node x) { return x != null && x.color == RED; }
    private int size(Node x) { return x == null ? 0 : x.n; }
    public int size() { return size(root); }

    public V get(K key) {
        Node x = root;
        while (x != null) {
            int c = key.compareTo(x.key);
            if (c == 0) return x.val;
            x = c < 0 ? x.left : x.right;
        }
        return null;
    }

    public void put(K key, V val) {
        root = put(root, key, val);
        root.color = BLACK;
    }

    private Node put(Node h, K key, V val) {
        if (h == null) return new Node(key, val);
        int c = key.compareTo(h.key);
        if (c < 0) h.left = put(h.left, key, val);
        else if (c > 0) h.right = put(h.right, key, val);
        else h.val = val;

        // Three fix-ups on the way back up keep the tree balanced:
        if (isRed(h.right) && !isRed(h.left))    h = rotateLeft(h);   // red links must lean left
        if (isRed(h.left) && isRed(h.left.left)) h = rotateRight(h);  // no two reds in a row
        if (isRed(h.left) && isRed(h.right))     flipColors(h);       // split a full node, push red up
        h.n = 1 + size(h.left) + size(h.right);
        return h;
    }

    private Node rotateLeft(Node h) {
        Node x = h.right;
        h.right = x.left;
        x.left = h;
        x.color = h.color;
        h.color = RED;
        x.n = h.n;                                    // x now roots the same subtree
        h.n = 1 + size(h.left) + size(h.right);
        return x;
    }

    private Node rotateRight(Node h) {
        Node x = h.left;
        h.left = x.right;
        x.right = h;
        x.color = h.color;
        h.color = RED;
        x.n = h.n;
        h.n = 1 + size(h.left) + size(h.right);
        return x;
    }

    private void flipColors(Node h) {
        h.color = RED;
        h.left.color = BLACK;
        h.right.color = BLACK;
    }

    public K floorKey(K key) {                        // greatest key <= key, or null
        Node x = root;
        K best = null;
        while (x != null) {
            int c = key.compareTo(x.key);
            if (c == 0) return x.key;
            if (c > 0) { best = x.key; x = x.right; } else x = x.left;
        }
        return best;
    }

    public K ceilingKey(K key) {                      // smallest key >= key, or null
        Node x = root;
        K best = null;
        while (x != null) {
            int c = key.compareTo(x.key);
            if (c == 0) return x.key;
            if (c < 0) { best = x.key; x = x.left; } else x = x.right;
        }
        return best;
    }

    public int rank(K key) {                          // how many keys are strictly less than key
        int r = 0;
        Node x = root;
        while (x != null) {
            int c = key.compareTo(x.key);
            if (c < 0) x = x.left;
            else if (c > 0) { r += 1 + size(x.left); x = x.right; }   // x and its left subtree are smaller
            else return r + size(x.left);
        }
        return r;
    }

    public K select(int k) {                          // k-th smallest key, 0-based
        if (k < 0 || k >= size()) throw new IllegalArgumentException("k out of range");
        Node x = root;
        while (true) {
            int ls = size(x.left);
            if (k < ls) x = x.left;
            else if (k > ls) { k -= ls + 1; x = x.right; }
            else return x.key;
        }
    }

    public int height() { return height(root); }
    private int height(Node x) { return x == null ? 0 : 1 + Math.max(height(x.left), height(x.right)); }
}
```

### What the colours mean (plain English)

Think of a **red link** as "glue": a red node and its parent together form one fat node holding 2 keys. Then the rules say:

- Fat nodes hold at most 2 keys (no two reds in a row; a third key forces a **split**: `flipColors`).
- Every path from the root to an empty spot crosses the **same number of black links**: the tree is perfectly balanced if you count only black links.

So the height is at most 2 × (black height) ≤ 2·log₂n.

### See it work

```java
RankedTreeMap<Integer, Integer> t = new RankedTreeMap<>();
for (int i = 1; i <= 1_000_000; i++) t.put(i, i);   // sorted input: worst case for a plain BST
System.out.println(t.height());                    // about 20-40, not 1,000,000
System.out.println(t.rank(500_000));               // 499999 keys are smaller
System.out.println(t.select(0));                   // 1
System.out.println(t.floorKey(0));                 // null
```

A plain unbalanced BST fed sorted input becomes a linked list: height 1,000,000, every operation O(n), and the recursive `put` would throw `StackOverflowError`.

Deletion in an LLRB tree is trickier (about 40 more lines); in practice, for rank queries with deletions, a **Fenwick tree** over compressed values is simpler (see the patterns notes).

---

## Memory per entry (approximate, 64-bit JVM, compressed references)

| Structure | Node / entry object | Plus | ≈ total for `<Integer, Integer>` |
|---|---|---|---|
| `HashMap` | `Node`: 32 bytes | 4–8 bytes of table slot | ~70 bytes |
| `LinkedHashMap` | `Entry`: 40 bytes | table slot | ~78 bytes |
| `TreeMap` | `Entry`: 40 bytes (left, right, parent, color) | none | ~72 bytes |
| `int[]` indexed by key | 4 bytes | | 4 bytes |

(Both `Integer` key and value objects add 16 bytes each unless they're in the -128 … 127 cache.) One million `HashMap<Integer, Integer>` entries is roughly 70 MB, which is why a big `int[]` or a sort + two pointers often beats a map in memory-limited problems.

**Next:** [16. Hard Use Cases](/notes/coll-hard-cases)
