import { useLocation, useNavigate } from "react-router-dom";
import "../css/probrec.css";
import React, { useState, useEffect} from "react";
import { useHistory } from "react-router-dom";

const ProbRec = () => {
  const [problems, setProblems] = useState([]);



  useEffect(() => {

      chrome.runtime.sendMessage({ type: "getAllProblems" }, function (response) {
        if (response.problems) {
          console.log(response.problems);
          setProblems(response.problems);
        } else if (response.error) {
          console.error(response.error);
        }
      });
 
  }, []);

  return (
    <div id="cd-mySidenav" className="problink cd-sidenav">
      <h1>Recent Problems</h1>
      {problems.length > 0 ? (
        <ul>
          {problems.map((problem) => (
            <li key={problem.id}>
              <a href={problem.LeetCodeAddress}>
                {" "}
                {problem.ProblemDescription}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p>No problems found.</p>
      )}
    </div>
  );
};

export default ProbRec;
