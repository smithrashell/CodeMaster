import { Tooltip, UnstyledButton, Title, rem } from "@mantine/core";
import { Link, useNavigate, useLocation } from "react-router-dom";
import classes from "../css/DoubleNavbar.module.css";
import { NavbarLogo } from "./NavbarLogo";
import { mainLinksMockdata, subLinksData } from "./navigationConstants";
import { useNavigation } from "../../hooks/useNavigation";

export function DoubleNavbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { active, activeLink, setActive, setActiveLink } = useNavigation();

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
        <link.icon style={{ width: rem(32), height: rem(32) }} stroke={1.8} />
      </UnstyledButton>
    </Tooltip>
  ));

  const currentSubLinks = subLinksData[activeLink] || [];

  const subLinks = currentSubLinks.map((subLink) => {
    // Generate sublink path - Overview goes directly to "/"
    const subLinkPath = activeLink === "/" && subLink === "Overview" 
      ? "/"
      : `${activeLink === "/" ? "" : activeLink}/${subLink
          .toLowerCase()
          .replace(/\s+/g, "-")}`;

    // Check if current path matches this sublink
    const isActive = location.pathname === subLinkPath;

    return (
      <Link
        to={subLinkPath}
        className={`${classes.subLink} ${isActive ? classes.activeSubLink : ''}`}
        data-active={isActive || undefined}
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
            <NavbarLogo />
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
