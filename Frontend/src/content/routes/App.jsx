import "../css/main.css";
import React, { useState, useContext, createContext, useEffect } from "react";
import {
  Link,
  useLocation,
  MemoryRouter,
  Routes,
  Route,
  useNavigate,
} from "react-router-dom";
import { createMemoryHistory } from "history";
import ProbStat from "./probstat";
import Main from "./main";
import ProbGen from "./probgen";
import ProbRec from "./probrec";
import ProbTime from "./probtime";
import ProbSurvey from "./probsurvey";
import Settings from "./settings";
import TimerBanner from "../components/timercomponent";
import { PreviousRouteProvider } from "../components/PreviousRouteProvider";
import "@mantine/core/styles.css";
// import * as Sentry from "@sentry/react";
import { MantineProvider } from "@mantine/core";
const history = createMemoryHistory();

const Router = () => {
  // const navigate = useNavigate();

  // useEffect(() => {
  //   const handleLocationChange = () => {
  //     console.log("Location changed");
  //     // Handle location change logic here
  //     Sentry.startTransaction({ name: "locationchange" });
  //   };

  //   window.addEventListener("locationchange", handleLocationChange);

  //   return () => {
  //     window.removeEventListener("locationchange", handleLocationChange);
  //   };
  // }, [navigate]);

  return (
    <MemoryRouter history={history}>
      <MantineProvider>
        <PreviousRouteProvider>
          <Routes>
            <Route index element={<Main />} />
            <Route path="*" element={<Main />} />
            <Route path="/" exact element={<Main />}>
              <Route path="/Probtime" exact element={<ProbTime />} />
              <Route path="/Probstat" exact element={<ProbStat />} />
              <Route path="/Probgen" exact element={<ProbGen />} />
              <Route path="/ProbRec" exact element={<ProbRec />} />
              <Route path="/Settings" exact element={<Settings />} />
              <Route path="/ProbSurvey" exact element={<ProbSurvey />} />
              <Route path="/Timer" exact element={<TimerBanner />} />
            </Route>
          </Routes>
        </PreviousRouteProvider>
      </MantineProvider>
    </MemoryRouter>
  );
};

export default Router;
