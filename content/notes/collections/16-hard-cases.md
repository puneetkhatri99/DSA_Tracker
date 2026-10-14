# Hard Use Cases

> **Level:** Hard · **Part 16 of 16** in Java Collections
>
> **In one line:** the design and "hard" problems where you must **combine** collections, and pick each one because of how it works inside. Every case says what the problem needs, why each structure fits, and what happens under the hood.

| # | Problem | Combination | Key internal fact used |
|---|---|---|---|
| 1 | LRU Cache by hand | `HashMap` + doubly linked list | unlinking a node you already hold is O(1) |
| 2 | LFU Cache | `HashMap` + `LinkedHashSet` per frequency | `LinkedHashSet` = O(1) remove + oldest-first order |
| 3 | Insert / Delete / GetRandom O(1) | `ArrayList` + `HashMap` | removing the **last** array slot shifts nothing |
| 4 | Sliding Window Median | two `TreeSet`s of indices | tree removal is O(log n); heap removal is O(n) |
| 5 | The Skyline Problem | `TreeMap` as a multiset | `lastKey()` = current max, with deletions |
| 6 | Maximum Frequency Stack | `HashMap` + stack per frequency | a value lives in several stacks at once |
| 7 | Time-Based Key-Value Store | `HashMap` of `TreeMap`s | `floorEntry` = "latest at or before t" |
| 8 | Merge K Sorted Lists | `PriorityQueue` of size k | heap holds one candidate per list |
| 9 | Contains Duplicate III | `TreeSet` sliding window | `ceiling` finds the nearest value |
| 10 | My Calendar III | `TreeMap` difference map | sorted iteration = a sweep line |

---

## 1. LRU Cache by hand (LeetCode 146)

**Needs:** `get` and `put` in O(1); when full, evict the least recently used key.

**Why these structures:**
- A `HashMap<key, Node>` finds a key's node in O(1).
- A **doubly linked list** keeps recency order. Because the map hands us the node itself, we can unlink it in O(1) (we know its `prev` and `next`). An `ArrayList` would need an O(n) shift.
- Two **sentinel** nodes (`head`, `tail`) mean the list is never empty, so there are no null checks.

```java
class LRUCache {
    private static final class Node {
        int key, val;
        Node prev, next;
        Node(int k, int v) { key = k; val = v; }
    }

    private final int cap;
    private final Map<Integer, Node> map = new HashMap<>();
    private final Node head = new Node(0, 0), tail = new Node(0, 0);   // head side = most recent

    LRUCache(int capacity) {
        cap = capacity;
        head.next = tail;
        tail.prev = head;
    }

    public int get(int key) {
        Node n = map.get(key);
        if (n == null) return -1;
        unlink(n);
        addFront(n);                        // touched: now the most recent
        return n.val;
    }

    public void put(int key, int value) {
        Node n = map.get(key);
        if (n != null) {
            n.val = value;
            unlink(n);
            addFront(n);
            return;
        }
        if (map.size() == cap) {
            Node lru = tail.prev;           // least recent sits just before the tail sentinel
            unlink(lru);
            map.remove(lru.key);            // the node stores its key exactly for this line
        }
        n = new Node(key, value);
        map.put(key, n);
        addFront(n);
    }

    private void unlink(Node n) { n.prev.next = n.next; n.next.prev = n.prev; }

    private void addFront(Node n) {
        n.next = head.next;
        n.prev = head;
        head.next.prev = n;
        head.next = n;
    }
}
```

**Inside:** this is exactly what `LinkedHashMap(cap, 0.75f, true)` does, with the list threaded through the map's own entries ([note 9](/notes/coll-linkedhashmap)). **O(1)** per operation, O(capacity) memory.

---

## 2. LFU Cache (LeetCode 460)

**Needs:** evict the key used the **fewest** times; among ties, the least recently used. Everything O(1).

**Why these structures:**
- `val`: key → value, `freq`: key → use count.
- `buckets`: count → `LinkedHashSet` of keys with that count. A `LinkedHashSet` gives O(1) `remove(key)` (hash part) **and** "oldest first" iteration (linked part), which is exactly "LRU among ties".
- `minFreq` tracks the smallest count, so eviction never searches.

```java
class LFUCache {
    private final int cap;
    private int minFreq = 0;
    private final Map<Integer, Integer> val = new HashMap<>();
    private final Map<Integer, Integer> freq = new HashMap<>();
    private final Map<Integer, LinkedHashSet<Integer>> buckets = new HashMap<>();   // count -> keys, oldest first

    LFUCache(int capacity) { cap = capacity; }

    public int get(int key) {
        if (!val.containsKey(key)) return -1;
        touch(key);
        return val.get(key);
    }

    public void put(int key, int value) {
        if (cap == 0) return;
        if (val.containsKey(key)) {
            val.put(key, value);
            touch(key);
            return;
        }
        if (val.size() == cap) {
            LinkedHashSet<Integer> keys = buckets.get(minFreq);
            int evict = keys.iterator().next();           // fewest uses, and oldest among those
            keys.remove(evict);
            if (keys.isEmpty()) buckets.remove(minFreq);
            val.remove(evict);
            freq.remove(evict);
        }
        val.put(key, value);
        freq.put(key, 1);
        buckets.computeIfAbsent(1, f -> new LinkedHashSet<>()).add(key);
        minFreq = 1;                                       // a brand-new key always has the lowest count
    }

    private void touch(int key) {                          // move key from bucket f to bucket f + 1
        int f = freq.get(key);
        freq.put(key, f + 1);
        LinkedHashSet<Integer> keys = buckets.get(f);
        keys.remove(key);
        if (keys.isEmpty()) {
            buckets.remove(f);
            if (minFreq == f) minFreq = f + 1;
        }
        buckets.computeIfAbsent(f + 1, x -> new LinkedHashSet<>()).add(key);   // joins at the "newest" end
    }
}
```

**Inside:** `keys.iterator().next()` reads the `LinkedHashMap` head pointer behind the set: O(1). Every operation is a constant number of hash operations: **O(1)**.

---

## 3. Insert Delete GetRandom O(1) (LeetCode 380)

**Needs:** insert, remove and "random element with equal probability", all O(1).

**Why these structures:**
- Random access needs an **array** (`vals.get(random index)`); a `HashSet` can't pick a random element in O(1).
- Removing from the middle of an array is O(n)... unless you **swap the target with the last element** and remove the last, which shifts nothing.
- A `HashMap` value → index finds the target's slot in O(1).

```java
class RandomizedSet {
    private final List<Integer> vals = new ArrayList<>();
    private final Map<Integer, Integer> idx = new HashMap<>();   // value -> its index in vals
    private final Random rnd = new Random();

    public boolean insert(int v) {
        if (idx.containsKey(v)) return false;
        idx.put(v, vals.size());
        vals.add(v);
        return true;
    }

    public boolean remove(int v) {
        Integer i = idx.get(v);
        if (i == null) return false;
        int last = vals.get(vals.size() - 1);
        vals.set(i, last);              // move the last value into the hole
        idx.put(last, i);
        vals.remove(vals.size() - 1);   // remove at the END: O(1), nothing shifts
        idx.remove(v);                  // after idx.put, so it also works when v IS the last value
        return true;
    }

    public int getRandom() { return vals.get(rnd.nextInt(vals.size())); }
}
```

**Inside:** `ArrayList.remove(size - 1)` copies zero elements ([note 2](/notes/coll-arraylist)). Order in the list doesn't matter for this problem, which is what makes the swap legal.

---

## 4. Sliding Window Median (LeetCode 480)

**Needs:** the median of every window of size k.

**Why not two `PriorityQueue`s?** The two-heap trick works for a *stream*, but here elements also **leave** the window, and `PriorityQueue.remove(Object)` is O(n) (it must scan the array to find the element). That makes the whole thing O(n·k).

**Why two `TreeSet`s:** a red-black tree removes any element in O(log k). Store **indices** (not values) so duplicates are distinct, and compare by value, then index, so no two indices ever compare equal ([note 11](/notes/coll-custom-keys)).

```java
double[] medianSlidingWindow(int[] nums, int k) {
    Comparator<Integer> cmp = (a, b) -> nums[a] != nums[b] ? Integer.compare(nums[a], nums[b]) : Integer.compare(a, b);
    TreeSet<Integer> lo = new TreeSet<>(cmp);       // smaller half (indices); lo.last() is its max
    TreeSet<Integer> hi = new TreeSet<>(cmp);       // larger half; hi.first() is its min
    double[] res = new double[nums.length - k + 1];
    for (int i = 0; i < nums.length; i++) {
        lo.add(i);
        hi.add(lo.pollLast());                      // the biggest of the small half moves up
        if (hi.size() > lo.size()) lo.add(hi.pollFirst());   // keep |lo| == |hi| or |hi| + 1
        if (i >= k - 1) {
            res[i - k + 1] = k % 2 == 1 ? nums[lo.last()] : ((double) nums[lo.last()] + nums[hi.first()]) / 2.0;
            int out = i - k + 1;                    // index leaving the window
            if (!lo.remove(out)) hi.remove(out);    // O(log k): the index finds the exact element
        }
    }
    return res;
}
```

**Complexity:** O(n log k) time, O(k) space. The alternative is two heaps with **lazy deletion** (a `HashMap` of "to delete later" counts, cleaned when they reach the top): same big-O, more code.

---

## 5. The Skyline Problem (LeetCode 218)

**Needs:** the outline of overlapping buildings: report every x where the tallest current height changes.

**Why a `TreeMap` multiset:** sweep left to right. At a building's start add its height, at its end remove it, and after each event read the **current maximum**. A heap gives the max but can't remove an arbitrary height cheaply; a `TreeMap<height, count>` does both in O(log n), and the count handles equal heights.

```java
List<List<Integer>> getSkyline(int[][] buildings) {
    List<int[]> events = new ArrayList<>();
    for (int[] b : buildings) {
        events.add(new int[]{b[0], -b[2]});   // start: store -height so starts come before ends at the same x
        events.add(new int[]{b[1], b[2]});    // end
    }
    // by x; at equal x: taller starts first, then lower ends first (avoids fake intermediate points)
    events.sort((a, b) -> a[0] != b[0] ? Integer.compare(a[0], b[0]) : Integer.compare(a[1], b[1]));

    TreeMap<Integer, Integer> heights = new TreeMap<>();   // height -> how many buildings have it
    heights.put(0, 1);                                     // the ground is always there
    List<List<Integer>> res = new ArrayList<>();
    int prev = 0;
    for (int[] e : events) {
        if (e[1] < 0) heights.merge(-e[1], 1, Integer::sum);
        else if (heights.merge(e[1], -1, Integer::sum) == 0) heights.remove(e[1]);
        int cur = heights.lastKey();                       // tallest active building
        if (cur != prev) {
            res.add(List.of(e[0], cur));
            prev = cur;
        }
    }
    return res;
}
```

**Complexity:** O(n log n). The tie-breaking in the sort is the hard part; `TreeMap.lastKey()` is a walk down the right spine.

---

## 6. Maximum Frequency Stack (LeetCode 895)

**Needs:** `push(x)`, and `pop()` returns the most frequent value; ties go to the most recently pushed.

**Why these structures:** keep one stack per frequency. When x reaches frequency f, push it onto stack f. Then stack `maxFreq` holds exactly the candidates, newest on top. The trick: x **also stays** in stacks 1 … f−1, so after popping it from stack f, its lower copies are already in the right places.

```java
class FreqStack {
    private final Map<Integer, Integer> freq = new HashMap<>();
    private final Map<Integer, Deque<Integer>> group = new HashMap<>();   // frequency -> stack of values
    private int maxFreq = 0;

    public void push(int x) {
        int f = freq.merge(x, 1, Integer::sum);
        maxFreq = Math.max(maxFreq, f);
        group.computeIfAbsent(f, k -> new ArrayDeque<>()).push(x);
    }

    public int pop() {
        Deque<Integer> st = group.get(maxFreq);
        int x = st.pop();
        freq.merge(x, -1, Integer::sum);
        if (st.isEmpty()) {
            group.remove(maxFreq);
            maxFreq--;                       // stack maxFreq - 1 can't be empty: every value in the old top stack is also there
        }
        return x;
    }
}
```

**Complexity:** O(1) per operation.

---

## 7. Time-Based Key-Value Store (LeetCode 981)

**Needs:** `set(key, value, t)` and `get(key, t)` = the value with the largest timestamp ≤ t.

```java
class TimeMap {
    private final Map<String, TreeMap<Integer, String>> store = new HashMap<>();

    public void set(String key, String value, int timestamp) {
        store.computeIfAbsent(key, k -> new TreeMap<>()).put(timestamp, value);
    }

    public String get(String key, int timestamp) {
        TreeMap<Integer, String> t = store.get(key);
        if (t == null) return "";
        Map.Entry<Integer, String> e = t.floorEntry(timestamp);   // latest at or before timestamp
        return e == null ? "" : e.getValue();
    }
}
```

**Inside:** `floorEntry` is the "remember the best candidate while walking down" search from [note 13](/notes/coll-treemap). On LeetCode the timestamps arrive increasing, so an `ArrayList` per key plus binary search is also O(log n) and lighter; the `TreeMap` version also works when timestamps arrive out of order.

---

## 8. Merge K Sorted Lists (LeetCode 23)

**Why a heap of size k:** the next output is always the smallest of the k current heads. A heap gives it in O(log k), and we only ever hold one node per list.

```java
ListNode mergeKLists(ListNode[] lists) {
    PriorityQueue<ListNode> pq = new PriorityQueue<>((a, b) -> Integer.compare(a.val, b.val));
    for (ListNode l : lists) if (l != null) pq.offer(l);
    ListNode dummy = new ListNode(0), tail = dummy;
    while (!pq.isEmpty()) {
        ListNode n = pq.poll();
        tail.next = n;
        tail = n;
        if (n.next != null) pq.offer(n.next);   // that list's next candidate replaces it
    }
    return dummy.next;
}
```

**Complexity:** O(N log k) for N total nodes, O(k) extra space. Merging lists one by one would be O(N·k).

---

## 9. Contains Duplicate III (LeetCode 220)

**Needs:** two indices at most `indexDiff` apart whose values differ by at most `valueDiff`.

**Why a `TreeSet` window:** keep the last `indexDiff` values in a sorted set. For the new value x, the only candidate that matters is the **smallest value ≥ x − valueDiff** (`ceiling`). If it's ≤ x + valueDiff, we're done.

```java
boolean containsNearbyAlmostDuplicate(int[] nums, int indexDiff, int valueDiff) {
    TreeSet<Long> window = new TreeSet<>();                    // long: x - valueDiff can overflow int
    for (int i = 0; i < nums.length; i++) {
        long x = nums[i];
        Long c = window.ceiling(x - valueDiff);
        if (c != null && c <= x + valueDiff) return true;
        window.add(x);
        if (i >= indexDiff) window.remove((long) nums[i - indexDiff]);   // slide: drop the value now too far back
    }
    return false;
}
```

**Complexity:** O(n log k). There's an O(n) version with buckets of width `valueDiff + 1` in a `HashMap` (any two values in the same bucket are close enough; only neighbouring buckets need checking).

---

## 10. My Calendar III (LeetCode 732)

**Needs:** after each booking, the maximum number of bookings that overlap at any moment.

**Why a `TreeMap` difference map:** +1 at each start, −1 at each end. Walking the keys in **sorted** order with a running sum is a sweep line; the max running sum is the answer.

```java
class MyCalendarThree {
    private final TreeMap<Integer, Integer> diff = new TreeMap<>();

    public int book(int start, int end) {
        diff.merge(start, 1, Integer::sum);
        diff.merge(end, -1, Integer::sum);
        int running = 0, best = 0;
        for (int d : diff.values()) best = Math.max(best, running += d);   // values() iterates in key order
        return best;
    }
}
```

**Complexity:** O(n) per booking, O(n²) total: fine for n ≤ 400 bookings. For huge n, a lazy segment tree gives O(log C) per booking.

---

## How to pick the combination (the pattern behind all ten)

1. List the operations and the complexity each one needs.
2. For each operation, pick the structure whose **engine** makes it cheap: hashing for "find by key", a linked list for "remove a node I already hold", an array for "random index", a heap for "only the min", a tree for "min + arbitrary removal + nearest value".
3. Link them: the map stores **nodes / indices** into the other structure, so one O(1) lookup leads straight to the place to change.
4. Watch the hidden O(n) calls: `PriorityQueue.remove(Object)`, `ArrayList.remove(0)`, `list.contains`, `headSet(x).size()`.

**Back to start:** [1. Overview & Hierarchy](/notes/java-collections)
