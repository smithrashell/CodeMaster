import React, { useState, useEffect } from "react";
import { Tooltip, UnstyledButton, Title, rem } from "@mantine/core";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  IconGauge,
  IconDeviceDesktopAnalytics,
  IconCards,
  IconUser,
  IconClock,
  IconSettings,
  IconTrendingUp,
  IconTarget,
} from "@tabler/icons-react";
import classes from "./css/DoubleNavbar.module.css";

const mainLinksMockdata = [
  { icon: IconGauge, label: "Overview", path: "/" },
  { icon: IconTrendingUp, label: "Progress", path: "/progress" },
  { icon: IconClock, label: "Sessions", path: "/sessions" },
  { icon: IconTarget, label: "Strategy", path: "/strategy" },
  { icon: IconSettings, label: "Settings", path: "/settings" },
];

const subLinksData = {
  "/": ["Overview"],
  "/progress": ["Learning Progress", "Goals"],
  "/sessions": ["Session History", "Productivity Insights"],
  "/strategy": ["Tag Mastery", "Learning Path", "Mistake Analysis"],
  "/settings": ["General", "Appearance", "Accessibility"],
};

export function DoubleNavbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const [active, setActive] = useState("Overview");
  const [activeLink, setActiveLink] = useState("/");
  const [showSettingsSubmenu, setShowSettingsSubmenu] = useState(false);

  useEffect(() => {
    const splitPath = location.pathname.split("/");
    const mainPath = splitPath[1] === "" ? "/" : `/${splitPath[1]}`;

    // Handle overview sub-routes
    const resolvedMainPath = ["/overview"].includes(mainPath)
      ? "/"
      : mainPath;

    const currentMainLink = mainLinksMockdata.find(
      (link) => link.path === resolvedMainPath
    );

    if (currentMainLink) {
      setActive(currentMainLink.label);
      setActiveLink(resolvedMainPath);
    }

    // Auto-expand settings if inside any settings sub-tab
    if (resolvedMainPath === "/settings") {
      setShowSettingsSubmenu(false); // No longer using settings submenu since routes are flattened
    } else {
      setShowSettingsSubmenu(false);
    }
  }, [location.pathname]);

  const mainLinks = mainLinksMockdata.map((link) => (
    <Tooltip
      label={link.label}
      position="right"
      withArrow
      transitionProps={{ duration: 0 }}
      key={link.label}
    >
      <UnstyledButton
        onClick={() => {
          setActive(link.label);
          setActiveLink(link.path);
          navigate(link.path);
        }}
        className={classes.mainLink}
        data-active={link.label === active || undefined}
      >
        <link.icon style={{ width: rem(24), height: rem(24) }} stroke={1.5} />
      </UnstyledButton>
    </Tooltip>
  ));

  const currentSubLinks = subLinksData[activeLink] || [];

  const subLinks = currentSubLinks.map((subLink) => {
    const subLinkPath = `${activeLink === "/" ? "" : activeLink}/${subLink
      .toLowerCase()
      .replace(/\s+/g, "-")}`;

    return (
      <Link
        to={subLinkPath}
        className={classes.link}
        data-active={location.pathname === subLinkPath || undefined}
        key={subLink}
      >
        {subLink}
      </Link>
    );
  });

  return (
    <nav className={classes.navbar}>
      <div className={classes.wrapper}>
        <div className={classes.aside}>
          <div className={classes.logo}>
            <svg
              width={30}
              height={30}
              viewBox="0 0 737.28 737.28"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
              style={{ transform: 'scale(4)' }}
            >
              <path 
                id="shape0" 
                transform="matrix(0.72 0 0 0.72 251.604708904613 191.88)" 
                fill="currentColor" 
                strokeOpacity="0" 
                stroke="currentColor" 
                strokeWidth="0" 
                strokeLinecap="square" 
                strokeLinejoin="bevel" 
                d="M147 0C151.211 3.93498 166.932 26.1532 169.188 29.3125C169.595 29.8836 202.126 74.3287 202.578 74.9487C203.536 76.2643 204.496 77.5782 205.458 78.8906C207.063 81.086 238.244 123.37 240 125C245.352 119.177 269.016 91.1124 269.539 90.4941C272.503 86.9563 288.32 68 289 68C290.306 69.5503 318.589 109.71 322.911 116.037C330.25 126.771 337.796 137.355 345.438 147.875C349.896 154.015 354.237 160.222 358.5 166.5C368.295 181.564 368.295 181.564 379.448 195.578C384.369 201.286 384.859 205.795 384.766 213.168C384.781 214.824 384.805 223.895 384.789 227.586C384.799 230.236 384.811 232.885 384.826 235.535C384.857 241.977 384.982 358.036 384.984 358.862C384.992 362.08 385.093 414.596 385.097 416.843C385.11 425.366 385 471 384 472C382.477 472.133 335 473 333 471C332.966 468.904 331.905 345.342 332 326C323.071 338.321 314.233 350.7 305.488 363.153C299.668 371.441 271.5 416.105 265 416.605C262.93 414.234 225.241 372.135 223.125 369.188C220.199 365.111 192.01 325.515 191 324C190.67 373.17 190.34 422.34 190 473C139 472 139 472 137 470C137.309 468.661 138.134 349.958 138.136 348.611C138.137 345.813 137.979 243.383 138 236C144.905 235.924 183.34 235.649 184.659 235.639C187.527 236.081 221.715 286.684 223.383 289C229.109 296.949 259.895 336.602 261 338C261.66 338 293.963 294.243 298 288.5C302.707 281.807 336.024 235.479 336.551 234.695C337.09 231.457 336.62 230.901 334.887 228.215C333.839 226.775 332.772 225.35 331.688 223.938C331.136 223.192 323.718 213.237 322.297 211.254C318.577 205.484 313 200.02 313 199C312.02 197.652 291.262 168.583 291 168C288.388 170.532 277.25 184.338 273.825 188.427C270.374 192.547 250.727 216.464 250.137 217.18C249.592 217.837 243.602 225.323 243 226C242.01 226 241.02 226 240 226C238.533 224.462 211.82 188.359 207.315 182.221C203.555 177.101 198.262 169.509 194.438 164.438C189.71 158.162 186.592 154.313 182.005 147.935C173.422 136.012 151.244 106.185 149 103C144.49 107.918 132.256 124.287 130.039 127.164C129.325 128.091 117.46 144.059 115 149C113.37 150.702 97.1972 170.633 95.125 173.313C90.8446 178.862 77.9393 195.998 76.5175 198.546C73.7403 202.859 71.6721 205.571 66.5796 206.878C62.3195 207.158 8.16369 206.211 0 206C0 202.506 56.6946 127.891 65 116.605C68.5554 111.765 143.441 4.71479 147 0Z" 
              />
              <path 
                id="shape1" 
                transform="matrix(0.72 0 0 0.72 187.145159218997 354.467520191447)" 
                fill="currentColor" 
                strokeOpacity="0" 
                stroke="currentColor" 
                strokeWidth="0" 
                strokeLinecap="square" 
                strokeLinejoin="bevel" 
                d="M192.09 23.6173C197.372 28.2025 202.304 33.1418 207.152 38.1798C205.872 40.9895 199.452 48.0857 198.832 48.6954C198.213 49.3112 195.79 51.5453 195.152 52.1798C193.18 54.1406 180.442 66.9315 177.152 70.1798C174.05 69.1455 173.058 68.0618 170.867 65.7774C165.328 60.6169 158.98 56.4067 152.152 53.1798C151.264 52.7454 150.376 52.311 149.461 51.8634C132.201 44.3724 112.566 44.6432 95.0195 50.9962C75.2557 59.1548 62.3572 73.5947 54.1523 93.1798C51.5338 100.685 49.4613 108.213 49.1523 116.18C49.1124 117.14 49.0724 118.1 49.0312 119.09C48.5672 141.555 54.1674 162.419 69.9258 178.942C70.6605 179.68 71.3953 180.419 72.1523 181.18C72.7427 181.805 73.3331 182.43 73.9414 183.074C82.8811 191.797 98.2106 199.258 110.777 199.367C111.891 199.305 113.005 199.244 114.152 199.18C114.152 199.51 114.152 199.84 114.152 200.18C133.362 201.186 152.608 196.94 167.337 183.887C169.673 181.712 171.924 179.465 174.152 177.18C175.486 175.846 176.819 174.513 178.152 173.18C181.69 174.69 196.272 189.031 197.137 189.899C197.907 190.671 206.529 199.471 208.152 201.18C206.66 206.223 203.672 209.199 200.027 212.805C199.411 213.417 198.795 214.028 198.161 214.659C191.459 221.122 184.035 226.268 176.152 231.18C175.555 231.553 174.958 231.926 174.343 232.31C165.13 238.004 165.13 238.004 160.152 239.18C158.898 239.55 157.644 239.92 156.352 240.301C141.056 244.8 110.152 245.86 110.152 245.18C108.977 245.242 107.801 245.304 106.59 245.367C86.0415 245.303 64.6098 236.269 48.5078 223.973C46.538 222.473 40.9386 218.732 40.1523 218.18C40.1523 217.52 40.1523 216.86 40.1523 216.18C39.5877 215.946 39.0231 215.713 38.4414 215.473C22.5789 206.513 10.2349 180.691 5.24804 164.187C2.50805 153.751 0.369792 142.99 0.152336 132.18C0.113664 131.138 0.0749918 130.097 0.035148 129.024C-0.398879 107.997 3.16097 87.2757 12.1523 68.1798C12.6841 66.9636 12.6841 66.9636 13.2266 65.7228C19.8023 51.4406 30.8512 37.886 43.1523 28.1798C43.7466 27.5469 44.3409 26.9139 44.9531 26.2618C82.3779 -9.16877 153.154 -7.45435 192.09 23.6173Z" 
              />
            </svg>
          </div>
          {mainLinks}
        </div>
        <div className={classes.main}>
          <Title order={4} className={classes.title}>
            {active}
          </Title>
          <div>{subLinks}</div>
        </div>
      </div>
    </nav>
  );
}
