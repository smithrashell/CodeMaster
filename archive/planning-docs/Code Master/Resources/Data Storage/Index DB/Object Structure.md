
### **Problems Object**

1. **Problem ID:** A unique identifier for each problem.
2. **Problem Description:** A textual description of the problem.
3. **Problem Number Assoc:** Array - Might be related to other problems or sub-problems.
4. **leetCodeID:** A number to identify if it's from LeetCode.
5. **LeetCodeAddress:** Direct URL to the problem.
6. **Consecutive Failures:** Counts consecutive failures.
7. **Successful Attempts:** Tracks all successful attempts.
8. **Cooldown Status:** Activated if there are 3 consecutive failures.
9. **Review Schedule:** Set based on the Next Review Date in the "attempts" object and sourced from the most recent attempt.
10. **Box Level:** Current box (1-7) based on attempts and the table for intervals.
11. **Difficulty:** Aggregate  of  attempt difficulty 
12. **AttempStats**: Object in for aggregate statistics 

**AttemptStats**
1. **TotalAttempts**
2. **SuccessfulAttempts**
3. **UnsuccessfulAttempts**

### **Attempts Object**

1. **Attempt ID:** Unique identifier for each attempt.
2. **Problem ID:** Reference to the related problem.
3. **Success:** Boolean to indicate if the attempt was successful.
4. **Attempt Date:** The date of the attempt.
5. **Time Spent:** Duration spent on the problem.
6. **Intensive Review:** True if 2 consecutive failures. Once enable you have to spend 
		a set amount of time reviewing problem before it re-enters schedule.
1. **Evaluation:** User-rated difficulty, from 1 to 3.
2. **Comments:** Additional comments.

**Table for Intervals :**

| Box Level | Interval (Days) |
| --------- | --------------- |
| 0         | 1               |
| 1         | 3               |
| 2         | 7               |
| 3         | 14              |
| 4         | 30              |
| 5         | 45              |
| 6         | 60              |
| 7         | 90              |

## Session Object

1. **SessionID**: Unique identifier for each session I think it should be by date 
		that way we can also use it as a foreign key  
1. **Problem ID**: Array of problem Problem IDs
2. **Success Rate**: percent of successful problems 
3. **Total Time**: Total Time actively working on a problem 
4. **Review Time**: Total Time spent in review 
5. **AvgHandleTime**: measure of deviation from the Ideal 