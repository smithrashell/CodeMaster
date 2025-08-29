`async function calculateLimits(attempts) {

  let easy = 0, med = 0, hard = 0;

  let easyTime = 0, medTime = 0, hardTime = 0;

  

  attempts.forEach(attempt => {

  

   // console.log("checking if  i am getting the right data", attempt.Difficulty, attempt.TimeSpent)

    switch (attempt.Difficulty) {

      case 1:

        easy++;

        easyTime += attempt.TimeSpent;

        break;

      case 2:

        med++;

        medTime += attempt.TimeSpent;

        break;

      case 3:

        hard++;

        hardTime += attempt.TimeSpent;

        break;

    }

  });

  

  return {

    createdAt: new Date().toISOString(),

    easy: easy === 0 ? 0 : easyTime / easy,

    med: med === 0 ? 0 : medTime / med,

    hard: hard === 0 ? 0 : hardTime / hard

  };

}`
This is how I am calculating my limits, the results that I am getting for the generated limits are not useful. This is what is bring generated :
` { 
	createdAt: "2024-04-01T16:57:44.281Z",
	"easy": 4.027264185091178e+202,
	"hard": 4.190469792683847e+62, 
	"med": Infinity
	}`
 I have come to realize that I do not want the average but the median. I want to get the limits by deriving  where most of  submissions fall. 
Background : 
This is for a application that is responsible for making a review schedule bases on Leitner system of review. I wants the limits to be calculated from user attempts that will be calculated on a weekly basis. 

`async function calculateMedianTimes(attempts) {
  const timesByDifficulty = { easy: [], med: [], hard: [] };

  // Group attempt times by difficulty
  attempts.forEach(attempt => {
    const timeSpent = parseInt(attempt.TimeSpent, 10); // Ensure TimeSpent is a number
    switch (attempt.Difficulty) {
      case 1: timesByDifficulty.easy.push(timeSpent); break;
      case 2: timesByDifficulty.med.push(timeSpent); break;
      case 3: timesByDifficulty.hard.push(timeSpent); break;
    }
  });

  // Calculate median for each difficulty
  const medians = Object.fromEntries(
    Object.entries(timesByDifficulty).map(([difficulty, times]) => {
      const sortedTimes = times.sort((a, b) => a - b);
      const mid = Math.floor(sortedTimes.length / 2);
      const isEven = sortedTimes.length % 2 === 0;
      return [
        difficulty,
        isEven ? (sortedTimes[mid - 1] + sortedTimes[mid]) / 2 : sortedTimes[mid]
      ];
    })
  );

  return {
    createdAt: new Date().toISOString(),
    easy: medians.easy || 0,
    med: medians.med || 0,
    hard: medians.hard || 0
  };
}`

This function organizes times into arrays by difficulty, sorts them, and calculates the median for each. It's resilient against datasets with no attempts for a given difficulty, defaulting those medians to 0.
