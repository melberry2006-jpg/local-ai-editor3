/**
 * Local AI Image Editor
 * Root component with navigation setup.
 */

import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Toast from 'react-native-toast-message';

import GenerateScreen from './src/screens/GenerateScreen';
import GalleryScreen from './src/screens/GalleryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { initApiClient } from './src/services/api';
import { COLORS } from './src/utils/theme';

const Tab = createBottomTabNavigator();

export default function App() {
  useEffect(() => {
    initApiClient();
  }, []);

  return (
    <NavigationContainer>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <Tab.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.background },
          headerTintColor: COLORS.text,
          tabBarStyle: {
            backgroundColor: COLORS.surface,
            borderTopColor: COLORS.border,
          },
          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: COLORS.placeholder,
        }}
      >
        <Tab.Screen
          name="Generate"
          component={GenerateScreen}
          options={{
            title: 'Generate',
            tabBarLabel: 'Generate',
            tabBarIcon: ({ color }) => (
              <TabIcon label="✦" color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Gallery"
          component={GalleryScreen}
          options={{
            title: 'Gallery',
            tabBarLabel: 'Gallery',
            tabBarIcon: ({ color }) => (
              <TabIcon label="⊞" color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            title: 'Settings',
            tabBarLabel: 'Settings',
            tabBarIcon: ({ color }) => (
              <TabIcon label="⚙" color={color} />
            ),
          }}
        />
      </Tab.Navigator>
      <Toast />
    </NavigationContainer>
  );
}

// Simple text-based tab icon (no icon library dependency required at runtime)
function TabIcon({ label, color }: { label: string; color: string }) {
  const { Text } = require('react-native');
  return <Text style={{ fontSize: 18, color }}>{label}</Text>;
}
