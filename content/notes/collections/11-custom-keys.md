# equals, hashCode & Custom Keys

> **Level:** Medium · **Part 11 of 16** in Java Collections
>
> **In one line:** hash collections find things with `hashCode` (which bucket?) and then `equals` (is it really the one?). Override both, keep keys immutable, and prefer a `record`. Tree collections ignore both and use `compareTo` / the comparator instead.

---

## In plain English

Think of a library:

- `hashCode()` = **which shelf** the book should be on.
- `equals()` = **is this exactly the book I want** (once I'm at the shelf)?

If two copies of the "same" book are sent to **different shelves**, the librarian looks on the wrong shelf and says "not found", even though the book is in the library. That's what happens when `equals` says two objects are equal but their `hashCode`s differ.

---

## The contract

1. If `a.equals(b)` then `a.hashCode() == b.hashCode()`. **(The one that breaks maps.)**
2. Equal hash codes do **not** imply equal objects (collisions are allowed, just slower).
3. `equals` is reflexive (`a.equals(a)`), symmetric, transitive, and `a.equals(null)` is false.
4. Both must return the same answer as long as the fields they use don't change.

Default `Object` behaviour: `equals` is `==` (same object in memory), `hashCode` is based on identity. So two `new Point(1, 2)` objects are **different keys** unless you override both.

---

## What goes wrong, concretely

### 1. `equals` without `hashCode`

```java
class P {
    int x, y;
    P(int x, int y) { this.x = x; this.y = y; }
    @Override public boolean equals(Object o) {
        return o instanceof P p && x == p.x && y == p.y;
    }
    // hashCode NOT overridden
}
Set<P> s = new HashSet<>();
s.add(new P(1, 2));
s.contains(new P(1, 2));     // false (almost always): the two objects hash to different buckets
```

### 2. Mutating a key after inserting it

```java
List<Integer> key = new ArrayList<>(List.of(1, 2));
Map<List<Integer>, String> m = new HashMap<>();
m.put(key, "v");
key.add(3);                  // the hash changes, but the entry stays in the OLD bucket
m.get(key);                  // null
m.get(List.of(1, 2));        // null too: right bucket, but equals now fails
m.size();                    // 1: a "ghost" entry you can't reach any more
```

### 3. Arrays as keys

```java
Set<int[]> s = new HashSet<>();
s.add(new int[]{1, 2});
s.contains(new int[]{1, 2}); // false: arrays use identity equals/hashCode
```

### 4. A terrible hash

```java
@Override public int hashCode() { return 1; }   // legal, but every key lands in one bucket
```

Every operation becomes a walk through one long chain: O(n), or O(log n) once Java 8 turns the bucket into a tree (which only helps fully if the keys are `Comparable`).

---

## The right ways to build a key

```java
// 1. Records get equals, hashCode and toString automatically. The best choice for keys.
record Point(int x, int y) {}
Map<Point, Integer> dist = new HashMap<>();
dist.put(new Point(1, 2), 5);
dist.get(new Point(1, 2));          // 5

// 2. Manual class: override BOTH, using the same fields, and make the fields final
final class P {
    final int x, y;
    P(int x, int y) { this.x = x; this.y = y; }
    @Override public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof P)) return false;
        P p = (P) o;
        return x == p.x && y == p.y;
    }
    @Override public int hashCode() { return 31 * x + y; }   // or Objects.hash(x, y), slower
}

// 3. Cheapest key for two ints: pack them into one long (no object, no boxing per field)
long key = ((long) x << 32) | (y & 0xffffffffL);
int x2 = (int) (key >> 32), y2 = (int) key;     // unpack

// 4. Small grids: one int
int cell = r * cols + c;                          // r = cell / cols, c = cell % cols

// 5. Quick and simple, but slowest: a String
String sk = x + "," + y;
```

| Key style | Speed | Notes |
|---|---|---|
| `int` / `long` encoding | fastest | no allocation except boxing |
| `record` | fast | clean, readable |
| `List.of(a, b)` | medium | hashes the whole list every lookup |
| `String` like `"3,4"` | slowest | builds a string and hashes every char |

**Why 31 in `31 * x + y`?** It's an odd prime, so it spreads values well, and `31 * i` can be computed as `(i << 5) - i`. `String.hashCode` uses it too: `s[0]*31^(n-1) + s[1]*31^(n-2) + … + s[n-1]`.

`Objects.hash(x, y)` is convenient but allocates an `Object[]` and boxes every field on each call, which shows up in hot loops.

---

## Tree collections use `compareTo`, not `equals`

`TreeMap` / `TreeSet` never call `equals` or `hashCode`. Two keys are "the same" if `compare(a, b) == 0`. If that disagrees with `equals`, the two kinds of set disagree:

```java
BigDecimal one = new BigDecimal("1.0"), oneOO = new BigDecimal("1.00");
one.equals(oneOO);      // false: equals also compares the scale
one.compareTo(oneOO);   // 0: same numeric value

new HashSet<>(List.of(one, oneOO)).size();   // 2
new TreeSet<>(List.of(one, oneOO)).size();   // 1
```

The same thing silently drops data with a sloppy comparator:

```java
// Intervals sorted only by start: two intervals with the same start count as "equal"
TreeSet<int[]> bad = new TreeSet<>((a, b) -> Integer.compare(a[0], b[0]));
bad.add(new int[]{1, 5});
bad.add(new int[]{1, 9});      // silently ignored!
bad.size();                    // 1

// Fix: break ties until only truly identical items compare as 0
TreeSet<int[]> good = new TreeSet<>((a, b) -> a[0] != b[0] ? Integer.compare(a[0], b[0]) : Integer.compare(a[1], b[1]));
```

---

## Pitfalls

- Override **both** `equals` and `hashCode`, using the **same** fields.
- `equals(Object o)` must take `Object`. Writing `equals(P o)` *overloads* instead of overriding, and collections never call it. Use `@Override` so the compiler catches this.
- Never change a field used by `hashCode` / `compareTo` while the object is inside a `HashMap`, `HashSet`, `TreeMap`, `TreeSet` or `PriorityQueue`.
- `int[]` keys never match. Use a record, a packed `long`, `List.of`, or `Arrays.toString(arr)` as the key.
- A comparator that returns 0 for distinct items makes `TreeSet` / `TreeMap` drop them. Always add tie-breakers.

**Next:** [12. PriorityQueue (Heap)](/notes/coll-priorityqueue)
