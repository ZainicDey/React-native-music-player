import { Redirect } from 'expo-router';

// This just redirects to the first tab which is the index tab in (tabs) folder
export default function TabIndex() {
  return <Redirect href="/(tabs)" />;
}
