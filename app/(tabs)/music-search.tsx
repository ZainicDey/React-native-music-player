import { Audio } from 'expo-av';
import React, { useState } from 'react';
import { Button, FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface Song {
  trackId: number;
  trackName: string;
  artistName: string;
  previewUrl: string;
}

export default function MusicSearchPlayer() {
  const [query, setQuery] = useState('');
  const [songs, setSongs] = useState<Song[]>([]);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  const searchSongs = async () => {
    if (!query) return;
    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=20`);
    const data = await res.json();
    setSongs(data.results);
  };

  const playPreview = async (song: Song) => {
    if (sound) {
      await sound.unloadAsync();
      setSound(null);
    }
    const { sound: newSound } = await Audio.Sound.createAsync({ uri: song.previewUrl });
    setSound(newSound);
    setPlayingId(song.trackId);
    await newSound.playAsync();
    newSound.setOnPlaybackStatusUpdate(status => {
        if (!status.isLoaded) return;
        if (!status.isPlaying && status.didJustFinish) {
            setPlayingId(null);
        }
        });
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <TextInput
        placeholder="Search for a song..."
        value={query}
        onChangeText={setQuery}
        style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 8, marginBottom: 8 }}
      />
      <Button title="Search" onPress={searchSongs} />
      <FlatList
        data={songs}
        keyExtractor={item => item.trackId.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => playPreview(item)}>
            <View style={{ padding: 12, borderBottomWidth: 1, borderColor: '#eee' }}>
              <Text style={{ fontWeight: 'bold' }}>{item.trackName}</Text>
              <Text>{item.artistName}</Text>
              {playingId === item.trackId && <Text style={{ color: 'green' }}>Playing...</Text>}
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
