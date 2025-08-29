
How long does it take on average from when  a problem gets introduce  until you reach mastery ?

→ from BoxLevel 1 to 5 , Days/ Attempts 

What is Mastery ? When you have 3 successful attempt  & you are within the time limit for problem difficulty 

## Currently Values are as defined :

 totalAttempts =problem.SuccessfulAttempts + problem.ConsecutiveFailures;
successRate = problem.SuccessfulAttempts / totalAttempts;

```jsx
const timeLimitsByDifficulty = {
  1: 15, // 15 minutes for difficulty 1
  2: 25, // 25 minutes for difficulty 2
  3: 35  // 35 minutes for difficulty 3
  // add more if needed
};
const allowedTime = timeLimitsByDifficulty[attemptData.Difficulty];
const exceededTimeLimit = attemptData.TimeSpent > allowedTime;
```

### Changes

Attempt count : property on a problem running count of attempts

Success Rate:  success / attempt count 

two aggregations 

→ short term evaluation 

→ long term evaluation all attempts 

Toggle button for Timer mode → when toggled the timer will use a predefined time limit 

→ if toggle there will be a flag on problem if flag is present the leitner box calculation it will have an allowedTime value which will determine if the box level moves up  down if it is success full 

→ you wouldn’t need to edit the problem schema because the flag would be on the problem from the front end 

STATS on Session :

per study session we ca have a metric that tells us the effectiveness of session i.e if we reviewed 10 problems it could be a ratio of success vs failures