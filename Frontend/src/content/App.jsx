import "../content/css/main.css";
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

import ProbStat from "./features/statistics/probstat";
import Main from "./features/navigation/main";
import ProbGen from "./features/problems/probgen";
import ProbTime from "./features/problems/probtime";
import StrategyMap from "./features/strategy/StrategyMap";

import Settings from "./features/settings/settings";
import TimerBanner from "./components/timer/timercomponent";
import { PreviousRouteProvider } from "../shared/provider/PreviousRouteProvider";
import "@mantine/core/styles.css";
import ProbSubmission from "./features/problems/probsubmission";
import ProbDetail from "./features/problems/probdetail";
// import * as Sentry from "@sentry/react";
import { MantineProvider } from "@mantine/core";
import ThemeProviderWrapper from "../shared/provider/themeprovider";
import { AppProviders } from "../shared/provider/appprovider";

const history = createMemoryHistory();

const Router = () => {
  return (
    <AppProviders>
      <Routes>
        <Route index element={<Main />} />
        <Route path="*" element={<Main />} />
        <Route path="/" exact element={<Main />}>
          <Route path="/Probtime" exact element={<ProbTime />} />
          <Route path="/Probstat" exact element={<ProbStat />} />
          <Route path="/Probgen" exact element={<ProbGen />} />
          <Route path="/Strategy" exact element={<StrategyMap />} />
          <Route path="/Settings" exact element={<Settings />} />
          <Route path="/Timer" exact element={<TimerBanner />} />
        </Route>
      </Routes>
    </AppProviders>
  );
};

export default Router;
