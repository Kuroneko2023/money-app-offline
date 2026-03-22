import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function RootLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#180C2E',
          borderTopWidth: 2,
          borderTopColor: '#75F94C',
          height: 100,
          paddingBottom: 10,
          paddingTop: 5,
        },
        tabBarActiveTintColor: '#75F94C', // สีตอนเลือก (เขียวนีออน)
        tabBarInactiveTintColor: '#4A2A85', // สีตอนไม่ได้เลือก (ม่วงหม่น)
        tabBarLabelStyle: {
          fontWeight: '900',
          letterSpacing: 1,
          fontSize: 10,
        }
      }}
    >
      <Tabs.Screen 
        name="index" 
        options={{ 
          title: 'DATA ENTRY',
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'create' : 'create-outline'} size={24} color={color} />
        }} 
      />
      
      <Tabs.Screen 
        name="dashboard" 
        options={{ 
          title: 'DASHBOARD',
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'stats-chart' : 'stats-chart-outline'} size={24} color={color} />
        }} 
      />
    </Tabs>
  );
}