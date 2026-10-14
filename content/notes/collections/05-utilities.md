# Utilities, List.of & Conversions

> **Level:** Easy · **Part 5 of 16** in Java Collections
>
> **In one line:** `Collections` (with an **s**) and `Arrays` are toolboxes of static helper methods. `List.of`, `Arrays.asList` and `Collections.unmodifiableList` look alike but behave very differently when you try to change them.

---

## In plain English

- `Collection` (no s) is the **interface** that `List`, `Set` and `Queue` extend.
- `Collections` (with s) is a **toolbox class**: `sort`, `reverse`, `max`, `frequency`, `nCopies` … You never create it; you call `Collections.something(list)`.
- `Arrays` is the same kind of toolbox for plain arrays: `Arrays.sort`, `Arrays.fill`, `Arrays.asList`, `Arrays.toString`.

---

## The `Collections` toolbox

```java
List<Integer> list = new ArrayList<>(List.of(4, 1, 3, 1));

Collections.sort(list);                          // [1, 1, 3, 4]   O(n log n), stable
Collections.sort(list, Collections.reverseOrder());   // [4, 3, 1, 1]
Collections.reverse(list);                       // reverse in place, O(n)
Collections.max(list);  Collections.min(list);   // O(n)
Collections.max(list, comparator);               // with a custom order
Collections.frequency(list, 1);                  // 2, O(n)
Collections.swap(list, 0, 2);
Collections.shuffle(list);
Collections.fill(list, 0);                       // set every element
Collections.rotate(list, 1);                     // rotate right by 1
Collections.addAll(list, 7, 8, 9);

int pos = Collections.binarySearch(sortedList, 3);   // needs a SORTED list
// found: its index. not found: -(insertionPoint) - 1, always negative
int insertAt = pos >= 0 ? pos : -pos - 1;

List<Integer> ro = Collections.unmodifiableList(list);  // read-only VIEW: changes to list show through
List<Integer> zeros = Collections.nCopies(5, 0);        // immutable [0, 0, 0, 0, 0]
List<Integer> mutableZeros = new ArrayList<>(Collections.nCopies(5, 0));
List<Integer> empty = Collections.emptyList();          // immutable
List<Integer> one = Collections.singletonList(42);      // immutable, size 1

// Initialise a list of n empty lists
List<List<Integer>> adj = new ArrayList<>();
for (int i = 0; i < n; i++) adj.add(new ArrayList<>());
// NOT Collections.nCopies(n, new ArrayList<>()): that is n references to ONE list
```

`Arrays.binarySearch` uses the same "negative means not found" rule: `-(insertionPoint) - 1`.

---

## Copy vs window vs frame vs laminated card

The four ways to "make a list" behave like four different physical things:

| Call | Plain English | Can `add`/`remove`? | Can `set(i, x)`? | Sees later changes to the source? |
|---|---|---|---|---|
| `new ArrayList<>(x)` | a **photocopy**: yours to scribble on | yes | yes | no, independent |
| `Arrays.asList(arr)` | a **frame around the original array** | no (the frame has a fixed size) | yes, writes into `arr` | yes, it *is* the array |
| `Collections.unmodifiableList(x)` | a **shop window**: look, don't touch | no | no | yes, the owner can still change `x` |
| `List.of(a, b)` | a **laminated card**: nobody can change it | no | no | n/a, it has its own storage |

### The details

| | `List.of(a, b)` (Java 9+) | `Arrays.asList(a, b)` | `new ArrayList<>(...)` | `Collections.unmodifiableList(x)` |
|---|---|---|---|---|
| `add` / `remove` | `UnsupportedOperationException` | `UnsupportedOperationException` (fixed size) | OK | `UnsupportedOperationException` |
| `set(i, v)` | `UnsupportedOperationException` | OK, writes through to the array | OK | `UnsupportedOperationException` |
| `null` elements | NPE (even `contains(null)` throws) | allowed | allowed | allowed |
| Backed by | its own immutable storage | the original array | its own copy | a view of `x` (sees later changes) |
| `Collections.sort` on it | throws | works (sorts the array) | works | throws |

```java
List<Integer> fixed = Arrays.asList(1, 2, 3);
fixed.set(0, 9);        // OK
// fixed.add(4);        // UnsupportedOperationException

List<Integer> imm = List.of(1, 2, 3);
// imm.set(0, 9);       // UnsupportedOperationException

List<Integer> ok = new ArrayList<>(List.of(1, 2, 3));   // the fix: wrap in ArrayList
ok.add(4);

Set<Integer> s = Set.of(1, 2);          // immutable; Set.of(1, 1) throws IllegalArgumentException
Map<String, Integer> m = Map.of("a", 1);// immutable, at most 10 pairs; use Map.ofEntries for more
```

- `stream().toList()` (Java 16+) is also immutable. `Collectors.toList()` currently returns an `ArrayList`, but that isn't guaranteed.
- `Set.of` / `Map.of` iteration order is deliberately **randomised per JVM run**, so code that accidentally depends on it fails fast.

---

## Converting between arrays and collections

```java
import java.util.stream.*;

int[] arr = {3, 1, 2};

// int[] -> List<Integer>
List<Integer> l1 = Arrays.stream(arr).boxed().collect(Collectors.toList());  // mutable ArrayList
List<Integer> l2 = Arrays.stream(arr).boxed().toList();                      // immutable (Java 16+)
List<Integer> l3 = new ArrayList<>();
for (int x : arr) l3.add(x);                                                 // fastest, simplest

// List<Integer> -> int[]
int[] back1 = l1.stream().mapToInt(Integer::intValue).toArray();
int[] back2 = new int[l1.size()];
for (int i = 0; i < back2.length; i++) back2[i] = l1.get(i);

// Integer[] <-> List<Integer>
Integer[] boxed = {3, 1, 2};
List<Integer> view = Arrays.asList(boxed);                 // fixed-size view
List<Integer> own  = new ArrayList<>(Arrays.asList(boxed));// independent, mutable
Integer[] boxedBack = own.toArray(new Integer[0]);

// String[] <-> List<String>
String[] sa = {"b", "a"};
List<String> sl = new ArrayList<>(Arrays.asList(sa));
String[] saBack = sl.toArray(new String[0]);               // or sl.toArray(String[]::new) on Java 11+

// int[] -> Set<Integer>
Set<Integer> set = Arrays.stream(arr).boxed().collect(Collectors.toSet());
Set<Integer> set2 = new HashSet<>();
for (int x : arr) set2.add(x);

// Set<Integer> -> int[]
int[] fromSet = set.stream().mapToInt(Integer::intValue).toArray();

// List<int[]> -> int[][] (Merge Intervals return value)
List<int[]> merged = new ArrayList<>();
merged.add(new int[]{1, 6});
int[][] result = merged.toArray(new int[0][]);            // or new int[merged.size()][]

// List<List<Integer>> -> int[][]
List<List<Integer>> ll = List.of(List.of(1, 2), List.of(3));
int[][] jag = ll.stream().map(r -> r.stream().mapToInt(Integer::intValue).toArray()).toArray(int[][]::new);

// char[] / String -> List<Character>
List<Character> chars = "abc".chars().mapToObj(c -> (char) c).collect(Collectors.toList());

// Printing
System.out.println(Arrays.toString(arr));          // [3, 1, 2]
System.out.println(Arrays.deepToString(result));   // [[1, 6]]
System.out.println(l1);                            // collections print themselves
```

---

## Pitfalls

- **`Arrays.asList(int[])`** returns a `List<int[]>` of size **1** (the whole array is one element). To box a primitive array, use a stream or a loop.
- **`Collections.nCopies(n, new ArrayList<>())`** gives n references to the **same** list.
- **`List.of(...)` / `Arrays.asList(...)` / `stream().toList()`** can't grow. Wrap them in `new ArrayList<>(...)`.
- **`Collections.unmodifiableList(x)` is not a copy.** If someone changes `x`, your "read-only" list changes too. Use `List.copyOf(x)` for a true frozen copy.
- **`toArray()` with no argument** returns `Object[]`, which you can't cast to `Integer[]`. Pass `new Integer[0]`.
- **`Collections.binarySearch` on an unsorted list** returns garbage, not an error.

**Next:** [6. HashMap](/notes/coll-hashmap)
