# Internals I: Arrays, Deques & Heaps

> **Level:** Hard · **Part 14 of 16** in Java Collections
>
> **In one line:** build simplified but working versions of `ArrayList`, `ArrayDeque` and `PriorityQueue` from a plain array. Once you've written them, every complexity in the earlier notes becomes obvious, and you can hand-roll faster primitive versions when the JDK classes are too slow.

---

## Why bother?

1. **Interviews** ask "how does ArrayList grow?", "why is `PriorityQueue` iteration unsorted?", "implement a circular queue", "implement a heap".
2. **Speed**: the JDK classes store `Object`s, so every `int` is boxed. A hand-rolled `int` version is often 3–10x faster and uses ~5x less memory.
3. **Missing features**: Java's `ArrayDeque` has no `get(i)`, and `PriorityQueue` has no decrease-key. Your own versions can.

All three are the same idea: **a plain array plus a few integer indices**.

---

## 1. A dynamic array (ArrayList)

```java
import java.util.*;

public class MyArrayList<E> implements Iterable<E> {
    private Object[] data = new Object[0];
    private int size;
    private int modCount;                      // counts structural changes, for fail-fast iterators

    public void add(E e) {
        if (size == data.length) grow();
        data[size++] = e;
        modCount++;
    }

    public void add(int index, E e) {
        if (index < 0 || index > size) throw new IndexOutOfBoundsException(index);
        if (size == data.length) grow();
        System.arraycopy(data, index, data, index + 1, size - index);   // shift right: O(n - index)
        data[index] = e;
        size++;
        modCount++;
    }

    @SuppressWarnings("unchecked")
    public E get(int index) {
        Objects.checkIndex(index, size);       // bounds are size, not data.length
        return (E) data[index];
    }

    @SuppressWarnings("unchecked")
    public E remove(int index) {
        Objects.checkIndex(index, size);
        E old = (E) data[index];
        System.arraycopy(data, index + 1, data, index, size - index - 1);  // shift left
        data[--size] = null;                   // drop the stale reference so the GC can free it
        modCount++;
        return old;
    }

    public int size() { return size; }

    private void grow() {
        int newCap = data.length == 0 ? 10 : data.length + (data.length >> 1);   // 10, 15, 22, 33 ...
        data = Arrays.copyOf(data, newCap);
    }

    @Override
    public Iterator<E> iterator() {
        return new Iterator<>() {
            int cursor = 0, lastRet = -1, expected = modCount;

            public boolean hasNext() { return cursor != size; }

            @SuppressWarnings("unchecked")
            public E next() {
                if (modCount != expected) throw new ConcurrentModificationException();
                if (cursor >= size) throw new NoSuchElementException();
                lastRet = cursor;
                return (E) data[cursor++];
            }

            public void remove() {
                if (lastRet < 0) throw new IllegalStateException();
                if (modCount != expected) throw new ConcurrentModificationException();
                MyArrayList.this.remove(lastRet);
                cursor = lastRet;              // the next element slid into lastRet's slot
                lastRet = -1;
                expected = modCount;           // our own change: re-sync
            }
        };
    }
}
```

### Why `add` is amortised O(1): the proof in plain English

Each grow copies every element. With 1.5x growth, the copies for n adds are about n + n/1.5 + n/1.5² + … ≈ **3n** in total (a geometric series). 3n work spread over n adds = **3 per add = O(1)**.

Another way to see it (the "banker's" view): charge each `add` 4 coins. 1 coin pays for the write; the other 3 are saved. When the array is full, the elements added since the last grow have saved enough coins to pay for copying everything.

If you grew by a **fixed** amount instead (say +10 each time), the copies would be 10 + 20 + 30 + … ≈ n²/20: **O(n) per add**. Growing by a *factor* is what makes it work.

**Why 1.5 and not 2?** A bigger factor means fewer copies but more empty space. 1.5 wastes at most a third of the array; 2 can waste half. (`ArrayDeque` and `HashMap` double because they want sizes that are powers of two, or close to it.)

### `remove` sets the slot to `null` on purpose

Without `data[--size] = null`, the array would still point to the removed object, so the garbage collector could never free it: a **memory leak** caused by a stale reference.

---

## 2. A circular deque (ArrayDeque), for `int`s

```java
import java.util.*;

public class IntDeque {
    private int[] a = new int[8];
    private int head = 0;     // slot of the first element
    private int size = 0;     // elements live at slots head, head+1, ..., head+size-1 (wrapping)

    public void addLast(int x) {
        if (size == a.length) grow();
        a[(head + size) % a.length] = x;
        size++;
    }

    public void addFirst(int x) {
        if (size == a.length) grow();
        head = (head - 1 + a.length) % a.length;   // step back one slot, wrapping 0 -> last
        a[head] = x;
        size++;
    }

    public int pollFirst() {
        if (size == 0) throw new NoSuchElementException();
        int x = a[head];
        head = (head + 1) % a.length;
        size--;
        return x;
    }

    public int pollLast() {
        if (size == 0) throw new NoSuchElementException();
        size--;
        return a[(head + size) % a.length];
    }

    public int peekFirst() { if (size == 0) throw new NoSuchElementException(); return a[head]; }
    public int peekLast()  { if (size == 0) throw new NoSuchElementException(); return a[(head + size - 1) % a.length]; }
    public int get(int i)  { Objects.checkIndex(i, size); return a[(head + i) % a.length]; }   // O(1): java.util.ArrayDeque can't do this
    public int size()      { return size; }
    public boolean isEmpty() { return size == 0; }

    private void grow() {
        int[] b = new int[a.length * 2];
        for (int i = 0; i < size; i++) b[i] = a[(head + i) % a.length];   // "unwrap": first element goes to slot 0
        a = b;
        head = 0;
    }
}
```

**The wrap-around formula** `(head + i) % capacity` is the whole trick. The front moves by changing `head`, never by shifting elements.

**Power-of-two speed-up** (what Java 8's `ArrayDeque` did): if the capacity is always a power of two, `x % cap` can be replaced by `x & (cap - 1)`, which is one CPU instruction and also handles `-1` correctly: `(0 - 1) & 7 == 7`.

**Why unwrap on grow?** After doubling, the old "wrapped" layout (`[30 40 _ 10 20]` with head at 3) would be wrong in the bigger array. Copying in logical order to slots `0 … size-1` fixes it.

---

## 3. A binary heap (PriorityQueue), for `int`s

```java
import java.util.*;

public class IntMinHeap {
    private int[] h = new int[16];
    private int size;

    public IntMinHeap() { }

    public IntMinHeap(int[] values) {                 // heapify: O(n)
        h = Arrays.copyOf(values, Math.max(1, values.length));
        size = values.length;
        for (int i = size / 2 - 1; i >= 0; i--) siftDown(i);   // every non-leaf, bottom-up
    }

    public void offer(int x) {
        if (size == h.length) h = Arrays.copyOf(h, 2 * size);
        h[size] = x;
        siftUp(size++);
    }

    public int peek() {
        if (size == 0) throw new NoSuchElementException();
        return h[0];
    }

    public int poll() {
        if (size == 0) throw new NoSuchElementException();
        int top = h[0];
        h[0] = h[--size];                             // last element to the root ...
        siftDown(0);                                  // ... and let it sink
        return top;
    }

    public int size() { return size; }

    private void siftUp(int i) {
        int x = h[i];
        while (i > 0) {
            int p = (i - 1) / 2;
            if (h[p] <= x) break;
            h[i] = h[p];          // pull the parent down: a "hole" moves up (fewer writes than swapping)
            i = p;
        }
        h[i] = x;
    }

    private void siftDown(int i) {
        int x = h[i];
        while (2 * i + 1 < size) {
            int c = 2 * i + 1;                            // left child
            if (c + 1 < size && h[c + 1] < h[c]) c++;     // pick the smaller child
            if (x <= h[c]) break;
            h[i] = h[c];
            i = c;
        }
        h[i] = x;
    }
}
```

### Why heapify is O(n) and not O(n log n)

`siftDown` from a node costs its **height**, not log n. In a heap of n nodes, about n/2 are leaves (height 0, no work), n/4 have height 1, n/8 height 2, and so on:

```
total work ≈ n/4·1 + n/8·2 + n/16·3 + ...  =  n · Σ k/2^(k+1)  =  n
```

Inserting one by one with `offer` would be O(n log n), because each new element can bubble up the whole height.

### Why the array is "unsorted"

The heap only promises **parent ≤ children**. Siblings and cousins are in no particular order: `[1, 3, 8, 5]` and `[1, 8, 3, 5]` are both valid heaps of the same values. That's why `toString()` and the iterator show a jumble, and why `contains` must scan everything (O(n)).

---

## 4. Hard version: an indexed heap with decrease-key

`java.util.PriorityQueue` can't update a priority in O(log n) because it doesn't know *where* an element sits in its array. Keep a `pos[]` array that tracks it, and you can:

```java
import java.util.*;

// Min-heap of ids 0..n-1, ordered by key[id], with O(log n) update of any id's key.
class IndexedMinHeap {
    private final int[] heap;     // heap[slot] = id
    private final int[] pos;      // pos[id] = slot of id in heap, or -1 if absent
    private final long[] key;     // key[id] = priority
    private int size;

    IndexedMinHeap(int n) {
        heap = new int[n]; pos = new int[n]; key = new long[n];
        Arrays.fill(pos, -1);
    }

    boolean isEmpty() { return size == 0; }
    boolean contains(int id) { return pos[id] != -1; }
    long keyOf(int id) { return key[id]; }

    void push(int id, long k) {                    // insert, or change the key if already present
        if (contains(id)) {
            long old = key[id];
            key[id] = k;
            if (k < old) siftUp(pos[id]); else siftDown(pos[id]);
            return;
        }
        key[id] = k;
        heap[size] = id;
        pos[id] = size;
        siftUp(size++);
    }

    int pollId() {                                 // removes and returns the id with the smallest key
        int top = heap[0];
        swap(0, --size);
        pos[top] = -1;
        if (size > 0) siftDown(0);
        return top;
    }

    private void siftUp(int i) {
        while (i > 0) {
            int p = (i - 1) / 2;
            if (key[heap[p]] <= key[heap[i]]) break;
            swap(i, p);
            i = p;
        }
    }

    private void siftDown(int i) {
        while (2 * i + 1 < size) {
            int c = 2 * i + 1;
            if (c + 1 < size && key[heap[c + 1]] < key[heap[c]]) c++;
            if (key[heap[i]] <= key[heap[c]]) break;
            swap(i, c);
            i = c;
        }
    }

    private void swap(int i, int j) {              // keep pos[] in sync with every move
        int t = heap[i]; heap[i] = heap[j]; heap[j] = t;
        pos[heap[i]] = i;
        pos[heap[j]] = j;
    }
}

// Dijkstra with it: the heap never holds more than V entries -> O((V + E) log V), no stale entries
long[] dijkstra(List<List<int[]>> adj, int src) {
    int n = adj.size();
    long[] dist = new long[n];
    Arrays.fill(dist, Long.MAX_VALUE);
    dist[src] = 0;
    IndexedMinHeap pq = new IndexedMinHeap(n);
    pq.push(src, 0);
    while (!pq.isEmpty()) {
        int u = pq.pollId();
        for (int[] e : adj.get(u)) {
            int v = e[0];
            long nd = dist[u] + e[1];
            if (nd < dist[v]) { dist[v] = nd; pq.push(v, nd); }   // decrease-key, O(log V)
        }
    }
    return dist;
}
```

Compared with the lazy-deletion Dijkstra in the [PriorityQueue](/notes/coll-priorityqueue) note: same big-O in practice, but the heap stays at most V big, and there are no `long[]` allocations per edge.

---

## Memory: what an element really costs

Approximate, 64-bit HotSpot JVM with compressed references (the default under 32 GB heap):

| Storage | Bytes per element |
|---|---|
| `int[]` | 4 |
| `long[]` | 8 |
| `ArrayList<Integer>` | 4 (slot) + 16 (`Integer` object) = **~20**, plus up to 50% spare capacity |
| `ArrayDeque<Integer>` | same as `ArrayList` |
| `LinkedList<Integer>` | 24 (node) + 16 (`Integer`) = **~40** |
| `PriorityQueue<int[]>` with `int[2]` | 4 (slot) + 24 (array object) = **~28** |

`Integer.valueOf` reuses cached objects for -128 … 127, so small values cost only the slot.

**Next:** [15. Internals II: HashMap & TreeMap](/notes/coll-internals-maps)
