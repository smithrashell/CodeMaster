import React, { useState, useEffect, useContext } from "react";
import { navigate } from "react-router-dom"; // Import from `react-router-dom` if needed


const TimerButton = () => {
 const [time, setTime] = useState(0);
  const [content, setContent] = useState("");
  const [timerRunning, setTimerRunning] = useState(false);
  // const { time, setTime, timerRunning, setTimerRunning } = useContext(TimerContext);
  const [limit, setLimit] = useState(0);
  const minutes = Math.floor(time / 60);
  const seconds = time % 60;

  let min = `${minutes.toString().padStart(2, "0")}m`;
  let sec = `${seconds.toString().padStart(2, "0")}s`;

  // useEffect(() => { 

  //   console.log(min, sec)
  //   const fetchContent = () => {
  //     const fetchedHtml = document.body.innerHTML;
  //     console.log("injectedbutton", fetchedHtml);
  //     const regex = /\d+\.\s[\da-zA-Z\s]*/;
  //     const match = fetchedHtml.match(regex);
  //     if (match) {
  //       console.log("match", match[0]);
  //       const data = match[0].split(".");
  //       const trimmedData = data.map((e) => e.trim());
  //       console.log("data", trimmedData);
  //       let currlimit = 
  //       chrome.runtime.sendMessage(
  //         {type:"getLimits", id : trimmedData[0]},
  //         function(response) {
  //        console.log("limits", response)
         
  //           let limit = getTimeLimitForProblem(response.problem, response.limit);
  //           chrome.storage.local.set({ problemData: trimmedData, problem: response}, () => {
  //             console.log("Problem data saved to Chrome storage.");
  //           });

  //           chrome.storage.local.set({time: time}, () => {
  //             console.log("limit saved to Chrome storage.", time);
  //           })


  //           //  setLimit(limit);
  //           //  setTime(limit*60);
          
  //         } 
  //       );
  
       
      
  //     }
  //   };

  //   if(!timerRunning){
  //     fetchContent();
  //   }
    
 
  //   },[setTime, timerRunning] );



  
 
  const handleTimerClick = () => {
   
    

  };

  const handleReset = () => {
   // setTimerRunning(false);


  };

  // useEffect(() => {
  //   if(!timerRunning){
  //        chrome.storage.local.set({time: time}, () => {
  //     console.log("limit saved to Chrome storage.", time);
  //   })
  //   }

  //   console.log(time)
  // },[time, timerRunning]);
  const handleSubmit = () => {
    setTimerRunning(false);
    chrome.storage.local.set({time: time}, () => {
      console.log("**limit saved to Chrome storage.", time);
    })
    // Send a message directly to the background script
    chrome.runtime.sendMessage({
      type:"navigate",
      navigate: true,
      route: "/Probtime",
      content: content,
      time: Math.floor(time*60),
      
    });
  };

  return (
    <div className="btn">
      <button style={{ backgroundColor: "#000" }} onClick={handleReset}>
        Reset
      </button>
      <button
        onClick={handleTimerClick}
        style={{ color: timerRunning ? "green" : "red" }}
      >
        {min}:{sec}
      </button>
      <button style={{ backgroundColor: "#000" }} onClick={handleSubmit}>
        Submit
      </button>
    </div>
  );
};

const InjectedButton = () => {
  console.log("InjectedButton is rendering");
  return (
    
      <TimerButton />

  );
};

export default InjectedButton;
