import { Tooltip, UnstyledButton, Title, rem } from "@mantine/core";
import { Link, useNavigate } from "react-router-dom";
// TODO: Re-enable for display settings feature
// import { useChromeMessage } from "../hooks/useChromeMessage";
import classes from "./css/DoubleNavbar.module.css";
import { NavbarLogo } from "./NavbarLogo";
import { mainLinksMockdata, subLinksData } from "./navigationConstants";
import { useNavigation } from "../hooks/useNavigation";

export function DoubleNavbar() {
  const navigate = useNavigate();
  const { active, activeLink, setActive, setActiveLink } = useNavigation();
  
  // TODO: Re-enable for display settings feature
  // const [sidebarWidth, setSidebarWidth] = useState("normal");
  
  // // Load display settings for sidebar width
  // const { data: displaySettings } = useChromeMessage({ type: "getSettings" }, [], {
  //   onSuccess: (response) => {
  //     if (response?.display?.sidebarWidth) {
  //       setSidebarWidth(response.display.sidebarWidth);
  //     }
  //   },
  // });

  // // Calculate dynamic navbar width based on setting
  // const getNavbarWidth = () => {
  //   switch (sidebarWidth) {
  //     case "narrow": return "280px";  // 200px + 80px for aside
  //     case "wide": return "380px";    // 300px + 80px for aside  
  //     default: return "360px";        // 250px + 80px for aside (normal)
  //   }
  // };

  // // Calculate dynamic main section width 
  // const getMainSectionWidth = () => {
  //   switch (sidebarWidth) {
  //     case "narrow": return "200px";  // Main section width
  //     case "wide": return "300px";    // Main section width
  //     default: return "250px";        // Main section width (normal)
  //   }
  // };

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
        className={classes.link}
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
