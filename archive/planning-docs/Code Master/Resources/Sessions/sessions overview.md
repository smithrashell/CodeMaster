Introducing a session value or score to monitor the session success rate and adjusting the difficulty of problems dynamically can be an effective strategy to maintain engagement and prevent discouragement. Here's how you could implement this idea and some potential pitfalls to watch out for:

### Implementation Steps:

1. **Session Success Rate Tracking:**
   - **Data Structure:** Create a new database or data structure to track the success rate of each session. This could include fields for the user ID, session ID, total problems attempted, and total problems solved.
   - **Calculation:** After each session, calculate the success rate as the percentage of problems solved correctly over the total problems attempted.

2. **Dynamic Problem Adjustment:**
   - **Threshold Check:** After each session, compare the session's success rate with the 75% threshold.
   - **Problem Selection Logic:**
     - If the success rate is below 75%, identify a problem planned for the next session that's more difficult and replace it with an easier one. This could involve adjusting the Leitner box level for the next problem or selecting a problem from a lower box level.
     - Ensure that the replacement problem has not been recently reviewed by the user to maintain variety and effective learning.

3. **Database Updates:**
   - Update your tracking system to reflect the changes made to the problem list for the upcoming session, ensuring that any adjustments are recorded for future sessions.

### Potential Pitfalls:

- **Overadjustment:** Replacing too many difficult problems with easier ones could slow down the learning progress if not balanced properly. It's important to find a sweet spot where encouragement is provided without significantly diluting the challenge necessary for learning.
- **Loss of Progression Feeling:** Users might feel they are not making progress if they keep encountering problems that are too easy for them. This could lead to disengagement despite the higher success rates.
- **Complexity in Tracking and Implementation:** Managing a dynamic system with adjustments based on session performance can add complexity to your application. This includes ensuring data consistency, handling edge cases (e.g., very few problems left at an easier level), and maintaining user progress visibility.
- **User Frustration:** Some users may become frustrated if they perceive the system as holding them back by not providing enough challenging problems, especially if they are close to understanding the more difficult concepts.

To mitigate these pitfalls, consider implementing additional features, such as:

- **User Feedback Loop:** Allow users to provide feedback on problem difficulty and their own confidence levels. This can help adjust the difficulty level more accurately.  - Implemented 
- **Visibility and Control:** Give users some visibility into and control over the difficulty adjustment process. For example, allow users to request a challenging problem if they feel they are being held back.
- **Adaptive Algorithms:** Use more sophisticated algorithms that consider long-term progress and short-term engagement, possibly incorporating machine learning to personalize the difficulty level more effectively over time.

By carefully considering these implementation steps and potential pitfalls, you can create a more engaging and effective learning experience that adapts to the user's needs while still pushing them towards their learning goals.

## Backing Tracking 

We can reverse generate session data through reconstructing session by reviewing problems by review date. 
