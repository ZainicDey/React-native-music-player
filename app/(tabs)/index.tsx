import { AntDesign, Entypo, Feather } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { Audio } from 'expo-av';
import React, { useEffect, useState, useRef } from 'react';
import { 
	Button, Dimensions, FlatList, Image, Modal, Platform, SafeAreaView, 
	StyleSheet, Text, TextInput, TouchableOpacity, View 
} from 'react-native';

interface Song {
	trackId: number;
	trackName: string;
	artistName: string;
	previewUrl: string;
	artworkUrl100?: string;
}

export default function MusicHomeScreen() {
	const [query, setQuery] = useState('');
	const [songs, setSongs] = useState<Song[]>([]);
	const [playingId, setPlayingId] = useState<number | null>(null);
	const [sound, setSound] = useState<Audio.Sound | null>(null);
	const [currentSong, setCurrentSong] = useState<Song | null>(null);
	const [isPlayerOpen, setIsPlayerOpen] = useState(false);
	const [isPlaying, setIsPlaying] = useState(false);

	const playLockRef = useRef(false);

	const searchSongs = async (searchTerm: string) => {
		if (!searchTerm) {
			setSongs([]);
			return;
		}
		const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&entity=song&limit=20`);
		const data = await res.json();
		setSongs(data.results);
	};

	// Debounce search
	useEffect(() => {
		const handler = setTimeout(() => {
			searchSongs(query);
		}, 500);
		return () => clearTimeout(handler);
	}, [query]);

	const playPreview = async (song: Song) => {
		if (playLockRef.current) return;
		playLockRef.current = true;

		try {
			if (sound) {
				try { await sound.stopAsync(); } catch {}
				await sound.unloadAsync();
			}

			const { sound: newSound } = await Audio.Sound.createAsync({ uri: song.previewUrl });
			setSound(newSound);
			setPlayingId(song.trackId);
			setCurrentSong(song);
			setIsPlaying(true);

			await newSound.playAsync();

			newSound.setOnPlaybackStatusUpdate(status => {
				if (!status.isLoaded) return;
				setIsPlaying(status.isPlaying);
				if (!status.isPlaying && status.didJustFinish) {
					setPlayingId(null);
					setIsPlaying(false);
				}
			});
		} finally {
			playLockRef.current = false;
		}
	};

	const pausePreview = async () => {
		if (sound) {
			await sound.pauseAsync();
			setIsPlaying(false);
		}
	};

	const resumePreview = async () => {
		if (sound) {
			await sound.playAsync();
			setIsPlaying(true);
		}
	};

	return (
		<View style={{ flex: 1, padding: 16, paddingTop: 40, paddingBottom: currentSong ? 80 : 16, backgroundColor: '#f5f5f5' }}>
			<TextInput
				placeholder="Search for a song..."
				value={query}
				onChangeText={setQuery}
				style={styles.input}
			/>
			<Button title="Search" onPress={() => searchSongs(query)} />

			<FlatList
				data={songs}
				keyExtractor={item => item.trackId.toString()}
				renderItem={({ item }) => (
					<TouchableOpacity onPress={() => playPreview(item)}>
						<View style={styles.songItem}>
							<Text style={styles.songTitle}>{item.trackName}</Text>
							<Text style={styles.songArtist}>{item.artistName}</Text>
							{playingId === item.trackId && <Text style={{ color: 'green' }}>Playing...</Text>}
						</View>
					</TouchableOpacity>
				)}
			/>

			{currentSong && (
				<TouchableOpacity
					style={styles.bottomPanel}
					onPress={() => setIsPlayerOpen(true)}
					activeOpacity={0.8}
				>
					<View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
						<View style={{ flex: 1 }}>
							<Text numberOfLines={1} style={{ fontWeight: 'bold' }}>{currentSong.trackName}</Text>
							<Text numberOfLines={1}>{currentSong.artistName}</Text>
						</View>

						{isPlaying ? (
							<Button title="Pause" onPress={pausePreview} />
						) : (
							<Button title="Play" onPress={resumePreview} />
						)}

						<TouchableOpacity
							style={styles.closeButton}
							onPress={e => {
								e.stopPropagation();
								setCurrentSong(null);
								setPlayingId(null);
								setIsPlaying(false);
								if (sound) {
									sound.stopAsync();
									sound.unloadAsync();
									setSound(null);
								}
							}}
						>
							<AntDesign name="close" size={18} color="#e75480" />
						</TouchableOpacity>
					</View>
				</TouchableOpacity>
			)}

			<Modal visible={isPlayerOpen} animationType="slide" transparent onRequestClose={() => setIsPlayerOpen(false)}>
				<SafeAreaView style={styles.modalContainer}>
					<View style={styles.playerModal}>
						{/* Top Bar */}
						<View style={styles.mainbar}>
							<AntDesign name="down" size={24} style={{ marginLeft: 10 }} onPress={() => setIsPlayerOpen(false)} />
							<Text style={styles.nowPlayingText}>Now Playing</Text>
							<Entypo name="dots-three-horizontal" size={24} style={{ marginRight: 10 }} />
						</View>

						{/* Artwork */}
						<View style={styles.musicLogoView}>
							<Image
								source={currentSong?.artworkUrl100 ? { uri: currentSong.artworkUrl100 } : require('../../assets/images/partial-react-logo.png')}
								style={styles.imageView}
								resizeMode="cover"
							/>
						</View>

						{/* Song Info */}
						<View style={styles.songInfoView}>
							<Text style={styles.songTitle}>{currentSong?.trackName}</Text>
							<Text style={styles.songArtist}>{currentSong?.artistName}</Text>
						</View>

						{/* Slider */}
						<View style={styles.sliderView}>
							<Text style={styles.sliderTime}>0:00</Text>
							{Platform.OS === 'web' ? (
								<View style={[styles.sliderStyle, { backgroundColor: '#d3d3d3', borderRadius: 5, overflow: 'hidden', height: 8 }]}>
									<View style={{ width: '0%', height: '100%', backgroundColor: '#e75480' }} />
								</View>
							) : (
								<Slider
									style={styles.sliderStyle}
									minimumValue={0}
									maximumValue={30}
									minimumTrackTintColor="#e75480"
									maximumTrackTintColor="#d3d3d3"
									thumbTintColor="#e75480"
									value={0}
									disabled
								/>
							)}
							<Text style={styles.sliderTime}>0:30</Text>
						</View>

						{/* Controls */}
						<View style={styles.functionsView}>
							<Entypo name="shuffle" size={24} color="#e75480" style={{ marginHorizontal: 10 }} />
							<Entypo name="controller-fast-backward" size={24} color="#e75480" style={{ marginHorizontal: 10 }} />
							{isPlaying ? (
								<AntDesign name="pausecircle" size={50} color="#e75480" style={{ marginHorizontal: 10 }} onPress={pausePreview} />
							) : (
								<AntDesign name="play" size={50} color="#e75480" style={{ marginHorizontal: 10 }} onPress={resumePreview} />
							)}
							<Entypo name="controller-fast-forward" size={24} color="#e75480" style={{ marginHorizontal: 10 }} />
							<Feather name="repeat" size={20} color="#e75480" style={{ marginHorizontal: 10 }} />
						</View>
					</View>
				</SafeAreaView>
			</Modal>
		</View>
	);
}

const Dev_Height = Dimensions.get('window').height;
const Dev_Width = Dimensions.get('window').width;

const styles = StyleSheet.create({
	input: {
		borderWidth: 1,
		borderColor: '#ccc',
		borderRadius: 8,
		padding: 8,
		marginBottom: 8,
	},
	songItem: {
		padding: 12,
		borderBottomWidth: 1,
		borderColor: '#eee',
	},
	songTitle: { fontWeight: 'bold', color: '#000', fontSize: 16 },
	songArtist: { color: '#000' },

	bottomPanel: {
		position: 'absolute',
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: '#fff',
		borderTopWidth: 1,
		borderColor: '#ccc',
		padding: 12,
		elevation: 8,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: -2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
	},
	closeButton: {
		marginLeft: 10,
		backgroundColor: '#fff',
		borderRadius: 16,
		width: 32,
		height: 32,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 1,
		borderColor: '#e75480',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
		elevation: 2,
	},
	modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
	playerModal: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 24, alignItems: 'center', minHeight: Dev_Height * 0.7, width: Dev_Width },
	mainbar: { height: 50, width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
	nowPlayingText: { fontSize: 19, fontWeight: 'bold', textAlign: 'center', flex: 1 },
	musicLogoView: { height: '30%', width: '100%', justifyContent: 'center', alignItems: 'center' },
	imageView: { height: 180, width: 180, borderRadius: 10, backgroundColor: '#eee' },
	songInfoView: { height: 70, width: '100%', alignItems: 'center', justifyContent: 'center', marginVertical: 10 },
	sliderView: { height: 50, width: '100%', alignItems: 'center', flexDirection: 'row', marginVertical: 10 },
	sliderStyle: { height: 40, width: '60%' },
	sliderTime: { fontSize: 15, marginLeft: 16, marginRight: 16, color: '#808080' },
	functionsView: { flexDirection: 'row', height: 60, width: '100%', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
});
