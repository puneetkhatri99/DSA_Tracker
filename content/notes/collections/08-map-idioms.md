# Map Idioms

> **Level:** Medium · **Part 8 of 16** in Java Collections
>
> **In one line:** the handful of `Map` recipes that show up in almost every hashing problem: count, decrement-and-remove, group, first-occurrence, iterate, sort by value, top-K.

---

## In plain English: merge, compute and friends

These methods each do "look up the key, then decide what to store" in **one** call (and one hash lookup):

| Method | Plain English |
|---|---|
| `getOrDefault(k, d)` | "Give me the value, or `d` if there's nothing." Stores nothing. |
| `putIfAbsent(k, v)` | "Store `v` only if the key is empty." `v` is created even when it isn't used. |
| `computeIfAbsent(k, fn)` | "If the key is empty, build a value with `fn`, store it, and hand it back." `fn` only runs when needed. |
| `merge(k, v, fn)` | "If the key is empty, store `v`; otherwise store `fn(old, v)`." Perfect for counting. |
| `compute(k, fn)` | "Store `fn(k, oldOrNull)`." The general version. |
| `computeIfPresent(k, fn)` | "Only if the key exists, replace with `fn(k, old)`." |

In every `compute*`/`merge`, **returning `null` from the function removes the key**.

---

## The recipes

```java
Map<String, Integer> freq = new HashMap<>();
String[] words = {"a", "b", "a"};

// 1. Counting: three equivalent ways
for (String w : words) freq.put(w, freq.getOrDefault(w, 0) + 1);
for (String w : words) freq.merge(w, 1, Integer::sum);            // most concise
for (String w : words) freq.compute(w, (k, v) -> v == null ? 1 : v + 1);

// 2. Decrement and remove at zero (sliding window)
freq.merge("a", -1, Integer::sum);
if (freq.get("a") == 0) freq.remove("a");
// or in one step: returning null from the remapping function removes the key
freq.computeIfPresent("a", (k, v) -> v == 1 ? null : v - 1);

// 3. Grouping: map from key to list (adjacency list, group anagrams)
Map<Integer, List<Integer>> graph = new HashMap<>();
graph.computeIfAbsent(1, x -> new ArrayList<>()).add(2);   // creates the list on first use
graph.computeIfAbsent(1, x -> new ArrayList<>()).add(3);   // reuses it: {1=[2, 3]}
graph.getOrDefault(99, Collections.emptyList());           // safe read for a missing key

// 4. putIfAbsent: keep the FIRST occurrence (e.g. first index of a prefix sum)
Map<Integer, Integer> firstIdx = new HashMap<>();
firstIdx.putIfAbsent(0, -1);
// putIfAbsent(k, new ArrayList<>()) allocates every call; prefer computeIfAbsent

// 5. Iterating
for (Map.Entry<String, Integer> e : freq.entrySet()) {
    String k = e.getKey();
    int v = e.getValue();
    e.setValue(v * 2);                 // allowed: modifies in place
}
for (String k : freq.keySet()) { }
for (int v : freq.values()) { }
freq.forEach((k, v) -> System.out.println(k + "=" + v));

// 6. Safe removal while iterating
freq.entrySet().removeIf(e -> e.getValue() < 2);
freq.values().removeIf(v -> v == 0);

// 7. Max entry by value
Map.Entry<String, Integer> best = Collections.max(freq.entrySet(), Map.Entry.comparingByValue());
```

### Prefix-sum count (Subarray Sum Equals K)

```java
int subarraySum(int[] nums, int k) {
    Map<Integer, Integer> count = new HashMap<>();
    count.put(0, 1);                                // the empty prefix
    int sum = 0, res = 0;
    for (int x : nums) {
        sum += x;
        res += count.getOrDefault(sum - k, 0);      // earlier prefixes that make a k-sum ending here
        count.merge(sum, 1, Integer::sum);
    }
    return res;
}
```

### Group Anagrams (a computed key)

```java
List<List<String>> groupAnagrams(String[] strs) {
    Map<String, List<String>> groups = new HashMap<>();
    for (String s : strs) {
        char[] c = s.toCharArray();
        Arrays.sort(c);                                       // "eat", "tea" -> "aet"
        groups.computeIfAbsent(new String(c), k -> new ArrayList<>()).add(s);
    }
    return new ArrayList<>(groups.values());
}
```

---

## Sorting a map by value

A `HashMap` can't be sorted in place. Pull out the entries, sort them, and optionally rebuild as a `LinkedHashMap`.

```java
Map<String, Integer> freq = Map.of("a", 3, "b", 1, "c", 2);

// A. List of entries (the most common approach in interviews)
List<Map.Entry<String, Integer>> entries = new ArrayList<>(freq.entrySet());
entries.sort((x, y) -> Integer.compare(y.getValue(), x.getValue()));        // value desc
// or: entries.sort(Map.Entry.<String, Integer>comparingByValue().reversed());
for (Map.Entry<String, Integer> e : entries) System.out.println(e.getKey() + " " + e.getValue());

// B. Value desc, then key asc for ties
entries.sort(Map.Entry.<String, Integer>comparingByValue(Comparator.reverseOrder())
                      .thenComparing(Map.Entry.comparingByKey()));

// C. Streams into a LinkedHashMap (keeps the sorted order)
Map<String, Integer> sorted = freq.entrySet().stream()
    .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
    .collect(java.util.stream.Collectors.toMap(
        Map.Entry::getKey, Map.Entry::getValue, (a, b) -> a, LinkedHashMap::new));

// D. Top-K frequent: a heap beats a full sort, O(n log k)
PriorityQueue<Map.Entry<String, Integer>> pq =
    new PriorityQueue<>((x, y) -> Integer.compare(x.getValue(), y.getValue()));   // min-heap by count
for (Map.Entry<String, Integer> e : freq.entrySet()) {
    pq.offer(e);
    if (pq.size() > 2) pq.poll();         // keep the k = 2 largest
}
```

### E. Bucket sort by frequency, O(n) (Top K Frequent Elements)

```java
int[] topKFrequent(int[] nums, int k) {
    Map<Integer, Integer> cnt = new HashMap<>();
    for (int x : nums) cnt.merge(x, 1, Integer::sum);
    List<Integer>[] buckets = new List[nums.length + 1];          // index = frequency
    for (Map.Entry<Integer, Integer> e : cnt.entrySet()) {
        int f = e.getValue();
        if (buckets[f] == null) buckets[f] = new ArrayList<>();
        buckets[f].add(e.getKey());
    }
    int[] res = new int[k];
    int i = 0;
    for (int f = nums.length; f > 0 && i < k; f--)
        if (buckets[f] != null) for (int x : buckets[f]) if (i < k) res[i++] = x;
    return res;
}
```

A frequency can never exceed `n`, so the buckets array has `n + 1` slots and no sorting is needed.

---

## Map.Entry and pairs

```java
Map.Entry<Integer, Integer> p = Map.entry(1, 2);                          // immutable, Java 9+, no nulls
Map.Entry<Integer, Integer> q = new AbstractMap.SimpleEntry<>(1, 2);      // mutable (setValue)
record Pair(int first, int second) {}                                     // cleanest custom pair
```

---

## Pitfalls

- **`freq.get(k) == 0` when `k` is missing** throws an NPE (unboxing `null`). Use `getOrDefault(k, 0) == 0`.
- **`putIfAbsent(k, new ArrayList<>())`** allocates a new list on every call, even when it's thrown away. `computeIfAbsent` only builds it when needed.
- **Recursive memoisation with `computeIfAbsent` throws.** In Java 9+, if the function itself changes the same `HashMap`, you get a `ConcurrentModificationException`:

  ```java
  Map<Integer, Long> memo = new HashMap<>();
  long fib(int n) {
      if (n < 2) return n;
      // return memo.computeIfAbsent(n, k -> fib(k - 1) + fib(k - 2));   // CME: fib() puts into memo mid-compute
      Long cached = memo.get(n);
      if (cached != null) return cached;
      long v = fib(n - 1) + fib(n - 2);
      memo.put(n, v);
      return v;
  }
  ```

- **Iterating `entrySet()` and calling `map.put(newKey, …)`** throws a CME. Updating the value of an existing key (`e.setValue`, or `put` on an existing key) is fine.
- **`Map.of(...)` is immutable** and holds at most 10 pairs; use `Map.ofEntries(...)` for more, and wrap in `new HashMap<>(...)` to change it.

**Next:** [9. LinkedHashMap & LRU](/notes/coll-linkedhashmap)
