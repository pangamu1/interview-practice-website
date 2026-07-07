// Committed fallback bank so the site works right after a fresh clone.
// Your real questions come from the Obsidian vault via build_questions.py,
// which writes questions.generated.js (gitignored) and overrides this.
window.QUESTION_BANK = [
  {
    id: "sample-sql-easy",
    lang: "sql",
    difficulty: "easy",
    title: "Second Highest Salary",
    source: "Sample question",
    solved: false,
    prompt:
      "From an `employees(name, salary)` table, return the second highest distinct salary. If it does not exist, return NULL.",
    hint: "Distinct the salaries, order descending, then skip the top one. `OFFSET 1 LIMIT 1`, or a subquery that excludes MAX.",
    solution:
      "SELECT MAX(salary) AS second_highest\nFROM employees\nWHERE salary < (SELECT MAX(salary) FROM employees);",
    note: "",
    tags: ["sql", "aggregation"],
  },
  {
    id: "sample-python-easy",
    lang: "python",
    difficulty: "easy",
    title: "Group Anagrams",
    source: "Sample question",
    solved: false,
    prompt:
      "Given a list of strings, group the anagrams together. Return a list of groups in any order.\n\nExample: `['eat','tea','tan','ate','nat','bat']` -> `[['eat','tea','ate'],['tan','nat'],['bat']]`.",
    hint: "Two words are anagrams iff their sorted letters match. Use the sorted string as a dict key.",
    solution:
      "from collections import defaultdict\n\ndef group_anagrams(words):\n    groups = defaultdict(list)\n    for w in words:\n        groups[''.join(sorted(w))].append(w)\n    return list(groups.values())\n\nprint(group_anagrams(['eat','tea','tan','ate','nat','bat']))",
    note: "",
    tags: ["python", "hashing"],
  },
  {
    id: "sample-pyspark-medium",
    lang: "pyspark",
    difficulty: "medium",
    title: "Top N Per Group",
    source: "Sample question",
    solved: false,
    prompt:
      "Given a DataFrame `df(category, product, revenue)`, return the top 2 products by revenue within each category.",
    hint: "Window partitioned by category, ordered by revenue desc, then filter row_number <= 2.",
    solution:
      "from pyspark.sql import Window\nfrom pyspark.sql import functions as F\n\nw = Window.partitionBy('category').orderBy(F.col('revenue').desc())\nresult = (df\n    .withColumn('rn', F.row_number().over(w))\n    .filter(F.col('rn') <= 2)\n    .drop('rn'))\nresult.show()",
    note: "",
    tags: ["pyspark", "window-functions"],
  },
];
