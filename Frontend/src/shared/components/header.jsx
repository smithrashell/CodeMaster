// HeaderWithClose.jsx
import { Title, ActionIcon } from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import {useNav} from '../../shared/provider/navprovider'
import { useEffect } from 'react';
export default function Header({ title }) {
  const {toggle,setToggle} = useNav()
  useEffect(()=>{
 console.log(toggle)
  }, [toggle])

  const styles = {
    container: {
      position: "relative",
      left: "35px",
    },
    header: {
      position:'absolute',
      width: "13em",
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '10px 20px',
    },
    title: {
      color: "var(--cd-text)",
    },
  };
  return (
    <div style={styles.container}>
      <div

      style={styles.header}
    >
      <Title order={3} style={styles.title}>{title}</Title>
      <ActionIcon onClick={()=> {setToggle(!toggle)}} variant="light" color="gray">
        <IconX size={18} />
      </ActionIcon>
    </div>
    </div>
  );
}
