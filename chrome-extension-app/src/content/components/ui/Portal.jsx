import { createPortal } from 'react-dom';

/**
 * Custom Portal component to replace Mantine Portal
 * Renders children in a portal to document.body or specified target
 */
const Portal = ({ children, target = document.body }) => {
  return createPortal(children, target);
};

export default Portal;