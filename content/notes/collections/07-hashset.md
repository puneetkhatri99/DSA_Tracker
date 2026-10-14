# HashSet & LinkedHashSet

> **Level:** Medium · **Part 7 of 16** in Java Collections
>
> **In one line:** a `HashSet` is a `HashMap` that only keeps keys. O(1) add / contains / remove, no duplicates, no order. `LinkedHashSet` adds "remember insertion order".

---

## In plain English

A `HashSet` is the bouncer's guest list at a party. Asking "is Priya on the list?" is instant, no matter how long the list is. A name can only be on it once; writing it again changes nothing.

A `LinkedHashSet` is the same guest list, but it also remembers **who arrived first**, so reading it back gives names in arrival order.

---

## How it works inside

There is no separate hashing code in `HashSet`. It literally wraps a `HashMap` and stores a dummy value:

```java
// From java.util.HashSet (lightly trimmed)
public class HashSet<E> {
    private transient HashMap<E, Object> map;
    private static final Object PRESENT = new Object();   // one shared dummy value

    public HashSet()               { map = new HashMap<>(); }
    public boolean add(E e)        { return map.put(e, PRESENT) == null; }   // null = "wasn't there before"
    public boolean contains(Object o) { return map.containsKey(o); }
    public boolean remove(Object o)   { return map.remove(o) == PRESENT; }
    public int size()              { return map.size(); }
}
```

So everything from the [HashMap](/notes/coll-hashmap) note applies: `hashCode` picks the bucket, `equals` confirms the match, the table doubles at 75% full, crowded buckets become trees.

`LinkedHashSet extends HashSet`, but its constructor makes the inner map a `LinkedHashMap`, whose entries are also threaded on a doubly linked list in insertion order (see [LinkedHashMap](/notes/coll-linkedhashmap)).

Memory: every element costs a full map node (about 32 bytes) plus the element object. A `boolean[]` costs 1 byte per possible value, so for small integer ranges it is far lighter.

---

## HashSet API

```java
Set<Integer> set = new HashSet<>();
Set<Integer> fromList = new HashSet<>(Arrays.asList(1, 2, 2, 3));   // {1, 2, 3}

boolean added = set.add(5);      // true the first time, false if already present
set.add(5);                      // false: duplicates ignored
set.contains(5);                 // O(1)
set.remove(5);                   // returns a boolean
set.size();  set.isEmpty();  set.clear();

// Set algebra (mutates the receiver, so copy first)
Set<Integer> a = new HashSet<>(List.of(1, 2, 3)), b = new HashSet<>(List.of(2, 3, 4));
Set<Integer> union = new HashSet<>(a);  union.addAll(b);      // {1,2,3,4}
Set<Integer> inter = new HashSet<>(a);  inter.retainAll(b);   // {2,3}
Set<Integer> diff  = new HashSet<>(a);  diff.removeAll(b);    // {1}

// Duplicate check in one line
boolean hasDup = new HashSet<>(list).size() < list.size();

// "Seen" check with add's return value
for (int x : nums) if (!set.add(x)) return true;              // found a duplicate

// Grid cells as keys: encode them, or use a record (NOT int[])
Set<Integer> seen = new HashSet<>();   seen.add(r * cols + c);
Set<String>  seen2 = new HashSet<>();  seen2.add(r + "," + c);   // slower but simple
record Cell(int r, int c) {}
Set<Cell>    seen3 = new HashSet<>();  seen3.add(new Cell(r, c));
Set<List<Integer>> seen4 = new HashSet<>(); seen4.add(List.of(r, c)); // List has value equals
```

### Longest Consecutive Sequence (the classic O(n) set trick)

```java
int longestConsecutive(int[] nums) {
    Set<Integer> s = new HashSet<>();
    for (int x : nums) s.add(x);
    int best = 0;
    for (int x : s) {
        if (s.contains(x - 1)) continue;          // only start counting at the beginning of a run
        int len = 1;
        while (s.contains(x + len)) len++;
        best = Math.max(best, len);
    }
    return best;   // each number is visited by the while loop at most once overall -> O(n)
}
```

---

## LinkedHashSet API

```java
Set<Character> lhs = new LinkedHashSet<>();
for (char c : "banana".toCharArray()) lhs.add(c);
System.out.println(lhs);                 // [b, a, n]: first-seen order kept

// Dedupe a list while keeping the original order
List<Integer> unique = new ArrayList<>(new LinkedHashSet<>(List.of(3, 1, 3, 2, 1)));  // [3, 1, 2]

// Oldest inserted element (e.g. a simple LFU bucket)
int oldest = lhs.iterator().next();
```

Re-adding an element that is already there does **not** move it to the end. Remove it and add it again if you want that.

---

## Complexity

| Operation | `HashSet` | `LinkedHashSet` |
|---|---|---|
| `add`, `contains`, `remove` | O(1) average | O(1) average |
| iteration | O(capacity + n), unpredictable order | O(n), insertion order |
| oldest element (`iterator().next()`) | n/a | O(1) |
| `addAll` / `retainAll` / `removeAll` | O(size of the argument) roughly | same |

## Use in DSA

- `HashSet`: visited sets, duplicate detection, O(1) membership (Two Sum variants, Longest Consecutive Sequence), deduping results.
- `LinkedHashSet`: dedupe while preserving order, and the per-frequency buckets in the **LFU cache** (O(1) removal plus "oldest" access). See [Hard Use Cases](/notes/coll-hard-cases).

## Pitfalls

- **`int[]` in a set** compares by identity: `set.contains(new int[]{1, 2})` is always false. Use a record, `List.of`, or an encoded number.
- **Changing an element after adding it** (e.g. a mutable list or object) moves it to the "wrong" bucket: `contains` fails and you can't even remove it.
- **`List` keys hash in O(k)** every time. For pairs, an encoded `long` or `r * cols + c` is much faster.
- **`removeAll(list)`** where the argument is a large `List` can be O(n·m) in some cases. Pass a `Set` instead.

**Next:** [8. Map Idioms](/notes/coll-map-idioms)
