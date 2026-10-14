# Iterators & Traps

> **Level:** Medium · **Part 10 of 16** in Java Collections
>
> **In one line:** change a collection while looping over it and Java throws `ConcurrentModificationException`; call `remove` with an `int` and it removes by index; compare two `Integer`s with `==` and it works … until 128. This note explains why each happens.

---

## Iterators in plain English

An **iterator** is a bookmark. A for-each loop is just a bookmark moving through the collection:

```java
for (int x : list) { ... }
// is compiled to:
Iterator<Integer> it = list.iterator();
while (it.hasNext()) { int x = it.next(); ... }
```

If someone tears pages out of the book while you're reading, your bookmark now points at the wrong page. Java detects this and stops you with a `ConcurrentModificationException` (CME) instead of silently giving you wrong data. That behaviour is called **fail-fast**.

---

## How the detection works inside

Every `ArrayList`, `HashMap`, `ArrayDeque` … keeps a counter `modCount` that goes up on each **structural** change (add, remove, clear, resize; *not* `set` on an existing slot). The iterator copies it when created and compares on every step:

```java
// Simplified from ArrayList.Itr
private class Itr implements Iterator<E> {
    int cursor;                          // index of the next element to return
    int lastRet = -1;                    // index of the last element returned
    int expectedModCount = modCount;     // snapshot

    public boolean hasNext() { return cursor != size; }

    public E next() {
        if (modCount != expectedModCount) throw new ConcurrentModificationException();
        lastRet = cursor;
        return (E) elementData[cursor++];
    }

    public void remove() {                       // the SAFE way to remove while iterating
        ArrayList.this.remove(lastRet);
        cursor = lastRet;
        lastRet = -1;
        expectedModCount = modCount;             // re-sync the snapshot
    }
}
```

### The puzzle that proves it

```java
List<Integer> list = new ArrayList<>(List.of(1, 2, 3));
for (int x : list) if (x == 2) list.remove(Integer.valueOf(x));   // NO exception!
System.out.println(list);   // [1, 3]
```

Removing the **second-to-last** element doesn't throw. After the removal `size` drops to 2 and `cursor` is already 2, so `hasNext()` returns false and `next()` (where the check lives) is never called again. Element 3 is simply never visited. Fail-fast is a best-effort safety net, not a guarantee, so never rely on it.

---

## Removing safely while iterating

```java
List<Integer> list = new ArrayList<>(List.of(1, 2, 3, 4, 5, 6));

// WRONG: throws ConcurrentModificationException
// for (int x : list) if (x % 2 == 0) list.remove(Integer.valueOf(x));

// FIX 1: Iterator.remove()
Iterator<Integer> it = list.iterator();
while (it.hasNext()) {
    if (it.next() % 2 == 0) it.remove();       // safe
}

// FIX 2: removeIf (cleanest, and O(n) total for ArrayList: one compaction pass)
list.removeIf(x -> x % 2 == 0);

// FIX 3: index loop going BACKWARDS (indices don't shift under you)
for (int i = list.size() - 1; i >= 0; i--) if (list.get(i) % 2 == 0) list.remove(i);

// FIX 4: collect the changes, apply them after the loop
List<Integer> toAdd = new ArrayList<>();
for (int x : list) if (x > 3) toAdd.add(x * 10);
list.addAll(toAdd);

// Maps too
Map<String, Integer> map = new HashMap<>(Map.of("a", 0, "b", 1));
// for (String k : map.keySet()) if (map.get(k) == 0) map.remove(k);   // CME
map.entrySet().removeIf(e -> e.getValue() == 0);                       // safe
Iterator<Map.Entry<String, Integer>> mit = map.entrySet().iterator();
while (mit.hasNext()) if (mit.next().getValue() == 0) mit.remove();    // safe
// Updating VALUES of existing keys (map.put(k, newV) for an existing k) during iteration is fine
```

Note the cost: `Iterator.remove()` on an `ArrayList` still shifts elements (O(n) each, O(n²) worst overall). `removeIf` does a single pass, O(n) total.

A forward index loop with `remove(i)` doesn't throw, but it **skips** the element after each removal. Go backwards, or do `i--` after removing.

### Fail-fast vs fail-safe

| Kind | Classes | Behaviour when changed during iteration |
|---|---|---|
| fail-fast | `ArrayList`, `HashMap`, `HashSet`, `TreeMap`, `ArrayDeque` … | throws CME (best effort) |
| snapshot ("fail-safe") | `CopyOnWriteArrayList` | iterates an old copy; never throws; writes cost O(n) |
| weakly consistent | `ConcurrentHashMap`, `ConcurrentLinkedQueue` | never throws; may or may not show recent changes |

The last two are for multi-threaded code; in DSA you use the first row.

---

## `list.remove(int index)` vs `list.remove(Object o)`

`List<Integer>` has two `remove` overloads. Java picks the most specific match **without boxing first**, so an `int` argument chooses **remove by index**.

```java
List<Integer> nums = new ArrayList<>(List.of(10, 20, 30, 1));

nums.remove(1);                     // removes INDEX 1 (value 20): [10, 30, 1]
nums.remove(Integer.valueOf(1));    // removes VALUE 1:             [10, 30]
nums.remove((Integer) 10);          // removes VALUE 10:            [30]
// nums.remove(30);                 // IndexOutOfBoundsException: treated as index 30!

int x = 30;
nums.remove((Integer) x);           // value removal with an int variable
```

`Set.remove` and `Deque.remove(Object)` have no index overload, so they're unaffected. `Deque.remove()` with no args removes the head.

---

## `==` on `Integer`: the 127 trap

```java
Integer a = 127, b = 127;
System.out.println(a == b);        // true
Integer c = 128, d = 128;
System.out.println(c == d);        // false!
System.out.println(c.equals(d));   // true
```

**Why:** boxing calls `Integer.valueOf(int)`, which returns a **cached** object for -128 … 127 and a **new** object otherwise. `==` on objects compares addresses, so it only "works" inside the cache range. Tests with small numbers pass; the judge's big numbers fail.

Where it bites in DSA:

```java
if (map.get(a) == map.get(b)) ...            // compares two Integer objects
if (stack.peek() == queue.peek()) ...        // same
if (list.get(i) == list.get(j)) ...          // same

// Fixes
if (map.get(a).equals(map.get(b))) ...
if ((int) stack.peek() == queue.peek()) ...  // unbox one side: int == Integer unboxes the other
int x = list.get(i), y = list.get(j); if (x == y) ...
```

## Unboxing `null`

```java
Map<String, Integer> m = new HashMap<>();
int v = m.get("missing");            // NullPointerException: null can't become an int
Deque<Integer> st = new ArrayDeque<>();
int top = st.peek();                 // NPE when empty
```

Use `getOrDefault`, check `isEmpty()`, or keep the result as `Integer` and null-check it.

---

## Other iteration surprises

- **Iterating a `PriorityQueue`** (or printing it) shows the internal heap array, not sorted order. Only repeated `poll()` gives order.
- **`subList` is a view.** Changing the parent list's size afterwards makes any use of the view throw a CME.
- **`keySet()`, `values()`, `entrySet()` are views.** Removing from them removes from the map.
- **Access-ordered `LinkedHashMap`**: even `get` is a structural change, so `get` during iteration throws.
- **`Arrays.asList(arr)` while changing `arr`**: the list *is* the array, so it changes too.

**Next:** [11. equals, hashCode & Custom Keys](/notes/coll-custom-keys)
