import { Card, Skeleton, Group } from "@mantine/core";

export default function ChartSkeleton({ title, height = 300 }) {
  return (
    <Card shadow="sm" p="lg">
      {title && (
        <Group justify="space-between" mb="sm">
          <Skeleton height={20} width="40%" />
          <Skeleton height={20} width={120} />
        </Group>
      )}
      
      {/* Chart area skeleton */}
      <div style={{ height, position: 'relative' }}>
        {/* Y-axis skeleton */}
        <div style={{ 
          position: 'absolute', 
          left: 0, 
          top: 0, 
          height: '100%', 
          width: 40,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          paddingTop: 10,
          paddingBottom: 30
        }}>
          <Skeleton height={12} width={30} />
          <Skeleton height={12} width={25} />
          <Skeleton height={12} width={30} />
          <Skeleton height={12} width={20} />
          <Skeleton height={12} width={25} />
        </div>
        
        {/* Chart content skeleton */}
        <div style={{ 
          marginLeft: 50, 
          marginRight: 20, 
          height: height - 40,
          marginTop: 10,
          position: 'relative'
        }}>
          {/* Chart bars/lines skeleton */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'end', 
            height: '100%', 
            gap: 8,
            paddingBottom: 30
          }}>
            <Skeleton height="60%" width={40} />
            <Skeleton height="80%" width={40} />
            <Skeleton height="45%" width={40} />
            <Skeleton height="90%" width={40} />
            <Skeleton height="65%" width={40} />
            <Skeleton height="75%" width={40} />
            <Skeleton height="55%" width={40} />
          </div>
          
          {/* X-axis skeleton */}
          <div style={{ 
            position: 'absolute', 
            bottom: 0, 
            left: 0, 
            right: 0, 
            display: 'flex', 
            justifyContent: 'space-between',
            paddingTop: 8
          }}>
            <Skeleton height={10} width={35} />
            <Skeleton height={10} width={35} />
            <Skeleton height={10} width={35} />
            <Skeleton height={10} width={35} />
            <Skeleton height={10} width={35} />
          </div>
        </div>
      </div>
    </Card>
  );
}