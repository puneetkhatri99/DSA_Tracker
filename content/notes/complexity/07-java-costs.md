# Hidden Costs in Java

> **Level:** Hard · **Part 7 of 8** in Time & Space Complexity
>
> **TL;DR**: many Java calls *look* like one step but walk the whole string, array or list. Put one of them inside a loop and an O(n) solution quietly becomes O(n²). This note lists the usual suspects, what each really costs, and the fix.

---

## The rule

**A method call costs what the method does, not 1.** Before writing a call inside a loop, ask: "does this touch every character / element?" If yes, it's O(n), and the loop is now O(n²).

---

## Strings

Java `String`s are **immutable**: any "change" builds a brand-new string and copies the characters.

| Code | Looks like | Actually | Fix |
|---|---|---|---|
| `s = s + c` / `s += c` in a loop | O(1) per step | O(current length) per step → **O(n²)** total | `StringBuilder.append` |
| `s.substring(i, j)` | O(1) | **O(j − i)**: copies the characters (since Java 7u6) | pass indices instead of substrings |
| `s.toCharArray()` | O(1) | O(n) copy | call it **once**, outside the loop |
| `s.toCharArray()[i]` inside a loop | O(1) | O(n) each → **O(n²)** | `s.charAt(i)` is O(1) |
| `s.equals(t)`, `s.compareTo(t)` | O(1) | O(length) | fine, but remember it in sorts / maps |
| `s.hashCode()` | O(1) | O(length) the first time, then cached | |
| `s.indexOf(t)`, `s.contains(t)`, `s.replace(a, b)` | O(1) | O(n) typical, up to O(n · m) | KMP / Z for heavy matching |
| `s.split(",")` | O(1) | O(n), plus creating every piece | fine once; avoid in hot loops |
| `s.split("\\s+")` in a loop | | compiles a regex **every call** | `Pattern p = Pattern.compile(...)` once, or `StringTokenizer` |
| `String.format(...)` | | parses the format string each call: slow constant | `StringBuilder` |
| `s.length()`, `s.charAt(i)`, `s.isEmpty()` | O(1) | **O(1)** ✓ | |

```java
// O(n²): each += copies the whole string built so far
String s = "";
for (int i = 0; i < n; i++) s += 'a';

// O(n)
StringBuilder sb = new StringBuilder();
for (int i = 0; i < n; i++) sb.append('a');
String result = sb.toString();
```

### Recursion that passes substrings

```java
boolean isPal(String s) {                       // looks O(n): n/2 calls ...
    if (s.length() < 2) return true;
    return s.charAt(0) == s.charAt(s.length() - 1) && isPal(s.substring(1, s.length() - 1));
}                                               // ... but each call copies the string: O(n²) time AND memory

boolean isPal(String s, int i, int j) {         // O(n) time, O(n) stack
    return i >= j || (s.charAt(i) == s.charAt(j) && isPal(s, i + 1, j - 1));
}
```

## StringBuilder

| Code | Cost |
|---|---|
| `sb.append(x)` | O(1) amortized (capacity grows ~2x) |
| `sb.charAt(i)`, `sb.setCharAt(i, c)`, `sb.length()` | O(1) |
| `sb.setLength(sb.length() - 1)` | O(1): the backtracking "undo" |
| `sb.deleteCharAt(sb.length() - 1)` | O(1) |
| `sb.insert(0, x)`, `sb.deleteCharAt(0)` | **O(n)**: shifts everything |
| `sb.reverse()` | O(n) |
| `sb.toString()` | **O(n)**: copies into a new `String` |

Calling `sb.toString()` (or `sb.insert(0, …)`) inside a loop is a classic hidden O(n²). Build forwards and `reverse()` once at the end.

---

## Arrays

| Code | Looks like | Actually |
|---|---|---|
| `new int[n]` | O(1) | **O(n)**: Java zero-fills every slot |
| `boolean[] seen = new boolean[n]` inside an O(n) loop | | **O(n²)** |
| `arr.clone()`, `Arrays.copyOf`, `Arrays.copyOfRange` | | O(n) |
| `Arrays.fill(arr, x)` | | O(n) |
| `Arrays.equals(a, b)`, `Arrays.toString(a)` | | O(n) |
| `Arrays.asList(arr)` | | O(1): a view, no copy |
| `System.arraycopy` | | O(n), but very fast (a memory move) |
| `arr.length` | | O(1) |

```java
// O(n²): reallocates and zero-fills n booleans on every iteration
for (int i = 0; i < n; i++) {
    boolean[] seen = new boolean[n];
    ...
}
// O(n) total: allocate once, and reset only the cells you actually touched
boolean[] seen = new boolean[n];
List<Integer> touched = new ArrayList<>();
```

## Sorting

| Call | Algorithm | Worst case |
|---|---|---|
| `Arrays.sort(int[])`, `long[]`, `char[]`, `double[]` | dual-pivot quicksort | O(n log n) on Java 14+; **O(n²) on Java ≤ 13** with crafted "anti-quicksort" inputs |
| `Arrays.sort(Integer[])`, `Arrays.sort(T[], cmp)`, `Collections.sort`, `list.sort` | TimSort (merge-based) | O(n log n), stable, O(n) on sorted input, O(n) extra memory |

On older judges (some still run Java 8 or 11), problem setters can add tests that push `Arrays.sort(int[])` to O(n²). Defences: shuffle the array first, or sort an `Integer[]` / `ArrayList` (TimSort can't be attacked, but boxing makes it slower).

Sorting **strings** or **arrays** costs more than n log n: each comparison is O(L), so it's **O(n · L · log n)**.

---

## Collections

| Code | Looks like | Actually |
|---|---|---|
| `list.remove(0)`, `list.add(0, x)` | O(1) | **O(n)** shift |
| `list.contains(x)`, `list.indexOf(x)`, `list.remove(Object)` | O(1) | **O(n)** scan |
| `linkedList.get(i)` | O(1) | **O(n)** walk |
| `deque.contains(x)` | O(1) | O(n) |
| `pq.remove(obj)`, `pq.contains(obj)` | O(log n) | **O(n)** |
| `treeSet.headSet(x).size()`, `subMap(a, b).size()` | O(log n) | **O(k)**: counts by walking |
| `map.containsValue(v)` | O(1) | O(n) |
| `map.keySet()`, `map.values()`, `list.subList(a, b)` | O(n) | O(1): views |
| `new ArrayList<>(coll)`, `new HashSet<>(coll)`, `List.copyOf` | | O(n) |
| `list.equals(other)`, `set.hashCode()`, `list.toArray()` | | O(n) |
| `Collections.max/min/frequency/reverse` | | O(n) |
| `HashMap` with `String` keys | O(1) | O(L) per operation to hash and compare the key |
| `HashMap` with `List<Integer>` keys | O(1) | O(k) per operation, and **every** call rehashes the list |
| `map.clear()` on a once-huge `HashMap` | O(1) | O(capacity): the table never shrinks |
| `ConcurrentLinkedQueue.size()` | O(1) | **O(n)**: it counts the nodes |

## Boxing and streams: same Big-O, bigger constants

| Code | Why it's slower |
|---|---|
| `Map<Integer, Integer>` vs `int[]` for keys `0 … n-1` | hashing + boxing + pointer chasing: often **5–10x** slower, ~15x the memory |
| `List<Integer>` vs `int[]` | each element is a separate object |
| `long sum` vs `Long sum` in a loop | `Long sum += x` creates a new `Long` object per step |
| `Arrays.stream(a).boxed()...` | allocates an `Integer` per element |
| streams in general | lambda + pipeline overhead; fine for clarity, slower in tight loops |

```java
Long total = 0L;
for (int x : nums) total += x;     // unbox, add, re-box: allocates up to n Long objects
long total2 = 0;
for (int x : nums) total2 += x;    // plain arithmetic
```

## I/O

| Code | Cost |
|---|---|
| `Scanner.nextInt()` for 10⁶ numbers | slow (regex-based parsing); can take seconds |
| `BufferedReader` + `StringTokenizer` / `Integer.parseInt` | ~10x faster |
| `System.out.println` called 10⁵+ times | slow; collect into one `StringBuilder` or a `PrintWriter` and flush once |

## Other surprises

| Thing | Cost |
|---|---|
| `Math.pow(a, b)` | O(1) but floating point: loses precision above 2⁵³; use integer multiplication or fast power |
| `BigInteger` multiply / divide | **not O(1)**: O(d²) or better for d-digit numbers |
| `Integer.parseInt(s)`, `Integer.toString(x)` | O(number of digits) |
| `Integer.bitCount`, `Long.numberOfTrailingZeros` | O(1) (single CPU instructions) |
| throwing exceptions in a loop | expensive: each one captures a stack trace; never use exceptions for normal control flow |
| deep recursion | `StackOverflowError` around 10⁴–10⁵ frames with the default stack ([Space Complexity](/notes/cx-space)) |
| `string.matches(regex)` with nested quantifiers like `(a+)+b` | can be **exponential** (see [Hard & Unusual Cases](/notes/cx-hard-cases)) |

---

## A self-check before submitting

1. Is there a `+=` on a `String` inside a loop?
2. Any `substring`, `toCharArray`, `toString`, `new int[n]` inside a loop?
3. Any `remove(0)`, `add(0, …)`, `contains`, `indexOf` on a `List` inside a loop?
4. Any `pq.remove(obj)` or `headSet(x).size()`?
5. Are map keys `String`s or `List`s when an `int` / `long` encoding would do?
6. Is recursion depth possibly ≥ 10⁴?
7. Is input ≥ 10⁵ numbers read with `Scanner`?

**Next:** [8. Hard & Unusual Cases](/notes/cx-hard-cases)
