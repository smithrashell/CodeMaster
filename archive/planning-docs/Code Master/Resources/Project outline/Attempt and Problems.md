I have two store . I have attempts that has the attempts for all the problem in my db. The objects in attempts looks like this : 
  {
    "key": "01262db4-27c6-4b49-bf45-39f48d8aec3b",
    "value": {
      "id": "01262db4-27c6-4b49-bf45-39f48d8aec3b",
      "ProblemID": "bb80f677-be25-4cab-9ba0-6e1db4c2b00a",
      "Success": false,
      "AttemptDate": "2024-10-22T16:13:40.866Z",
      "TimeSpent": 20,
      "Difficulty": 2,
      "Comments": "ugh"
    }
  }
 Then I have  the problem store whose objects looks as follows : {
    "key": "006737e7-fe64-43e2-8b5a-cfb9e86f6a11",
    "value": {
      "id": "006737e7-fe64-43e2-8b5a-cfb9e86f6a11",
      "ProblemDescription": "maximum subarray",
      "ProblemNumberAssoc": [],
      "leetCodeID": 53,
      "LeetCodeAddress": "https://leetcode.com/problems/maximum-subarray/description/",
      "ConsecutiveFailures": 0,
      "CooldownStatus": false,
      "BoxLevel": 7,
      "ReviewSchedule": "2025-02-20T18:58:32.607Z",
      "Difficulty": 17,
      "AttemptStats": {
        "TotalAttempts": 9,
        "SuccessfulAttempts": 6,
        "UnsuccessfulAttempts": 3
      },
      "lastAttemptDate": "2024-11-22T18:58:32.607Z",
      "Tags": [
        "Array",
        "Dynamic Programming"
      ],
      "Rating": "Medium"
    }
  }
I am using a weighted graph to capture problem relationships. 
I was able to create relationships from standard_problems but the relationships in problem_relationship don't have any  information  thats in attempts or problems .  I was think that on the problems object I can have a property like next problem which would give me a problem that is related or has the highest weight. 



I later would like to have it optimize to suggest problems that relate to this list of the main patterns:

    Arrays
    Binary Search
    BFS
    Bit Manipulation
    Bucket Sort
    Backtracking
    DFS
    Design
    Dynamic Programming
    Fast & Slow Pointers
    Graph
    Greedy
    Heap
    Intervals
    In-place Reversal of a Linked List
    QuickSelect
    Sliding Window
    Sorting
    Topological Sort
    Trie
    Two Pointers
    Union Find
