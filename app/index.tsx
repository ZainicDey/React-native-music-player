import { AntDesign, Entypo } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
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
	const [playlist, setPlaylist] = useState<Song[]>([]);
	const [playingId, setPlayingId] = useState<number | null>(null);
	const [sound, setSound] = useState<Audio.Sound | null>(null);
	const [currentSong, setCurrentSong] = useState<Song | null>(null);
	const [isPlayerOpen, setIsPlayerOpen] = useState(false);
	const [isPlaylistOpen, setIsPlaylistOpen] = useState(false);
	const [isPlaying, setIsPlaying] = useState(false);
	const [position, setPosition] = useState(0);
	const [duration, setDuration] = useState(30); // Default duration for previews is 30 seconds
	const [slidingPosition, setSlidingPosition] = useState<number | null>(null);
	const [isSeeking, setIsSeeking] = useState(false);

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

	const addToPlaylist = (song: Song) => {
		setPlaylist(prev => [...prev, song]);
	};

	const removeFromPlaylist = (songId: number) => {
		setPlaylist(prev => prev.filter(song => song.trackId !== songId));
	};

	const isInPlaylist = (songId: number) => {
		return playlist.some(song => song.trackId === songId);
	};

	const togglePlaylist = (song: Song, e: any) => {
		e.stopPropagation();
		if (isInPlaylist(song.trackId)) {
			removeFromPlaylist(song.trackId);
		} else {
			addToPlaylist(song);
		}
	};

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
				
				// Update position if not currently seeking
				if (!isSeeking && status.positionMillis !== undefined) {
					setPosition(status.positionMillis / 1000);
				}
				
				// Update duration once if available
				if (status.durationMillis && status.durationMillis > 0) {
					setDuration(status.durationMillis / 1000);
				}
				
				if (!status.isPlaying && status.didJustFinish) {
					setPlayingId(null);
					setIsPlaying(false);
					setPosition(0);
					// Auto-play next song from playlist if available
					playNextFromPlaylist();
				}
			});
		} finally {
			playLockRef.current = false;
		}
	};

	const playFromPlaylist = async (song: Song) => {
		// Check if this song is already in playlist
		const isInPlaylistSong = isInPlaylist(song.trackId);
		
		// If not in playlist, add it first
		if (!isInPlaylistSong) {
			addToPlaylist(song);
		}
		
		// Now play the song
		await playPreview(song);
	};

	const removeSongAfterPlaying = (songId: number) => {
		setPlaylist(prev => prev.filter(song => song.trackId !== songId));
	};

	const playNextFromPlaylist = async () => {
		if (playlist.length === 0) return;
		
		// Find current song index in playlist
		const currentIndex = currentSong ? playlist.findIndex(song => song.trackId === currentSong.trackId) : -1;
		let nextSong: Song;
		
		// Create updated playlist without current song
		const updatedPlaylist = playlist.filter(song => song.trackId !== currentSong?.trackId);
		
		// Update playlist state
		setPlaylist(updatedPlaylist);
		
		// Now find the next song to play from updated playlist
		if (currentIndex >= 0 && currentIndex < updatedPlaylist.length) {
			// Play the song at the same index (which is now the next song)
			nextSong = updatedPlaylist[currentIndex];
		} else if (updatedPlaylist.length > 0) {
			// If we were at the end or song wasn't in playlist, start from first
			nextSong = updatedPlaylist[0];
		} else {
			// No songs left in playlist
			return;
		}
		
		// Auto-play the next song
		await playPreview(nextSong);
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

	const shufflePlaylist = () => {
		if (playlist.length === 0) return;
		
		// Create a copy of the playlist and shuffle it
		const shuffledPlaylist = [...playlist];
		for (let i = shuffledPlaylist.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[shuffledPlaylist[i], shuffledPlaylist[j]] = [shuffledPlaylist[j], shuffledPlaylist[i]];
		}
		
		setPlaylist(shuffledPlaylist);
	};

	const playPreviousSong = () => {
		if (playlist.length === 0) return;
		
		const currentIndex = currentSong ? playlist.findIndex(song => song.trackId === currentSong.trackId) : -1;
		let previousSong: Song;
		
		if (currentIndex > 0) {
			// Play previous song
			previousSong = playlist[currentIndex - 1];
		} else if (playlist.length > 0) {
			// If at beginning, go to last song
			previousSong = playlist[playlist.length - 1];
		} else {
			return;
		}
		
		playPreview(previousSong);
	};

	const playNextSong = () => {
		if (playlist.length === 0) return;
		
		const currentIndex = currentSong ? playlist.findIndex(song => song.trackId === currentSong.trackId) : -1;
		let nextSong: Song;
		
		if (currentIndex >= 0 && currentIndex < playlist.length - 1) {
			// Play next song
			nextSong = playlist[currentIndex + 1];
		} else if (playlist.length > 0) {
			// If at end, go to first song
			nextSong = playlist[0];
		} else {
			return;
		}
		
		playPreview(nextSong);
	};

	// Helper function to format time
	const formatTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs < 10 ? '0' + secs : secs}`;
	};

	// Handle slider change
	const onSlidingStart = () => {
		setIsSeeking(true);
	};

	const onSlidingComplete = async (value: number) => {
		if (!sound) return;
		
		setIsSeeking(false);
		setPosition(value);
		
		try {
			await sound.setPositionAsync(Math.floor(value * 1000));
			// If it was playing before seeking, resume playback
			if (isPlaying) {
				await sound.playAsync();
			}
		} catch (error) {
			console.error("Failed to seek:", error);
		}
	};

	const onSliderValueChange = (value: number) => {
		setSlidingPosition(value);
	};

	return (
		<View style={{ flex: 1 }}>
			<LinearGradient
				colors={['#1e2a78', '#6c4e91', '#e75480']}
				style={styles.gradientBackground}
			>
				<View style={styles.contentContainer}>
					<TextInput
						placeholder="Search for a song..."
						value={query}
						onChangeText={setQuery}
						style={styles.input}
						placeholderTextColor="#aaa"
					/>
					<View style={styles.searchRow}>
						<Button title="Search" onPress={() => searchSongs(query)} />
						{playlist.length > 0 && (
							<TouchableOpacity 
								style={styles.playlistCounter}
								onPress={() => setIsPlaylistOpen(true)}
							>
								<Text style={styles.playlistCounterText}>Playlist: {playlist.length} songs</Text>
							</TouchableOpacity>
						)}
					</View>

					<FlatList
						data={songs}
						keyExtractor={item => item.trackId.toString()}
						renderItem={({ item }) => (
							<View style={styles.songItem}>
								<TouchableOpacity onPress={() => playFromPlaylist(item)} style={styles.songInfo}>
									<Text style={styles.songTitle}>{item.trackName}</Text>
									<Text style={styles.songArtist}>{item.artistName}</Text>
									{playingId === item.trackId && <Text style={{ color: '#5cff9d' }}>Playing...</Text>}
								</TouchableOpacity>
								<TouchableOpacity 
									onPress={(e) => togglePlaylist(item, e)}
									style={[
										styles.playlistButton,
										isInPlaylist(item.trackId) && styles.removeButton
									]}
								>
									<Text style={[
										styles.playlistButtonText,
										isInPlaylist(item.trackId) && styles.removeButtonText
									]}>
										{isInPlaylist(item.trackId) ? 'Remove' : 'Add'}
									</Text>
								</TouchableOpacity>
							</View>
						)}
					/>
				</View>
			</LinearGradient>

			{currentSong && (
				<TouchableOpacity
					style={styles.bottomPanel}
					onPress={() => setIsPlayerOpen(true)}
					activeOpacity={0.8}
				>
					<LinearGradient
						colors={['#1e2a78', '#6c4e91', '#e75480']}
						start={{ x: 0, y: 0 }}
						end={{ x: 1, y: 0 }}
						style={{ flex: 1, borderRadius: 8, padding: 12 }}
					>
						<View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
							<View style={{ flex: 1 }}>
								<Text numberOfLines={1} style={{ fontWeight: 'bold', color: '#fff' }}>{currentSong.trackName}</Text>
								<Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.8)' }}>{currentSong.artistName}</Text>
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
									setPosition(0);
									setSlidingPosition(null);
									if (sound) {
										sound.stopAsync();
										sound.unloadAsync();
										setSound(null);
									}
								}}
							>
								<AntDesign name="close" size={18} color="#fff" />
							</TouchableOpacity>
						</View>
					</LinearGradient>
				</TouchableOpacity>
			)}			<Modal visible={isPlayerOpen} animationType="slide" transparent onRequestClose={() => setIsPlayerOpen(false)}>
				<SafeAreaView style={styles.modalContainer}>
					<LinearGradient
						colors={['#1e2a78', '#6c4e91', '#e75480']}
						style={styles.playerModal}
					>
						{/* Top Bar */}
						<View style={styles.mainbar}>
							<AntDesign name="down" size={24} style={{ marginLeft: 10, color: '#fff' }} onPress={() => setIsPlayerOpen(false)} />
							<Text style={styles.nowPlayingText}>Now Playing</Text>
							<Entypo name="dots-three-horizontal" size={24} style={{ marginRight: 10, color: '#fff' }} />
						</View>

						{/* Artwork */}
						<View style={styles.musicLogoView}>
							<Image
								source={currentSong?.artworkUrl100 ? { uri: currentSong.artworkUrl100 } : require('../assets/images/partial-react-logo.png')}
								style={styles.imageView}
								resizeMode="cover"
							/>
						</View>

						{/* Song Info */}
						<View style={styles.songInfoView}>
							<Text style={[styles.songTitle, { fontSize: 20 }]}>{currentSong?.trackName}</Text>
							<Text style={[styles.songArtist, { fontSize: 16 }]}>{currentSong?.artistName}</Text>
						</View>

						{/* Slider */}
						<View style={styles.sliderView}>
							<Text style={[styles.sliderTime, { color: '#fff' }]}>{formatTime(isSeeking && slidingPosition !== null ? slidingPosition : position)}</Text>
							{Platform.OS === 'web' ? (
								<View style={[styles.sliderStyle, { backgroundColor: '#d3d3d3', borderRadius: 5, overflow: 'hidden', height: 8 }]}>
									<View style={{ 
										width: `${((isSeeking && slidingPosition !== null ? slidingPosition : position) / duration) * 100}%`, 
										height: '100%', 
										backgroundColor: '#e75480' 
									}} />
								</View>
							) : (
								<Slider
									style={styles.sliderStyle}
									minimumValue={0}
									maximumValue={duration}
									minimumTrackTintColor="#e75480"
									maximumTrackTintColor="#d3d3d3"
									thumbTintColor="#e75480"
									value={isSeeking && slidingPosition !== null ? slidingPosition : position}
									onSlidingStart={onSlidingStart}
									onSlidingComplete={onSlidingComplete}
									onValueChange={onSliderValueChange}
								/>
							)}
							<Text style={[styles.sliderTime, { color: '#fff' }]}>{formatTime(duration)}</Text>
						</View>

						{/* Controls */}
						<View style={styles.functionsView}>
							<TouchableOpacity onPress={shufflePlaylist}>
								<Entypo name="shuffle" size={24} color="#e75480" style={{ marginHorizontal: 10 }} />
							</TouchableOpacity>
							<TouchableOpacity onPress={playPreviousSong}>
								<Entypo name="controller-fast-backward" size={24} color="#e75480" style={{ marginHorizontal: 10 }} />
							</TouchableOpacity>
							{isPlaying ? (
								<TouchableOpacity onPress={pausePreview}>
									<AntDesign name="pausecircle" size={50} color="#e75480" style={{ marginHorizontal: 10 }} />
								</TouchableOpacity>
							) : (
								<TouchableOpacity onPress={resumePreview}>
									<AntDesign name="play" size={50} color="#e75480" style={{ marginHorizontal: 10 }} />
								</TouchableOpacity>
							)}
							<TouchableOpacity onPress={playNextSong}>
								<Entypo name="controller-fast-forward" size={24} color="#e75480" style={{ marginHorizontal: 10 }} />
							</TouchableOpacity>
							<TouchableOpacity onPress={() => setIsPlaylistOpen(true)}>
								<AntDesign name="bars" size={20} color="#e75480" style={{ marginHorizontal: 10 }} />
							</TouchableOpacity>
						</View>
					</LinearGradient>
				</SafeAreaView>
			</Modal>

			{/* Playlist Modal */}
			<Modal visible={isPlaylistOpen} animationType="slide" transparent onRequestClose={() => setIsPlaylistOpen(false)}>
				<SafeAreaView style={styles.modalContainer}>
					<LinearGradient
						colors={['#1e2a78', '#6c4e91', '#e75480']}
						style={styles.playlistModal}
					>
						{/* Top Bar */}
						<View style={styles.mainbar}>
							<AntDesign name="down" size={24} style={{ marginLeft: 10 }} onPress={() => setIsPlaylistOpen(false)} />
							<Text style={styles.nowPlayingText}>My Playlist ({playlist.length})</Text>
							<View style={styles.playlistHeaderButtons}>
								<TouchableOpacity onPress={() => setPlaylist([])} style={styles.clearPlaylistButton}>
									<Text style={styles.clearPlaylistText}>Clear All</Text>
								</TouchableOpacity>
								<TouchableOpacity onPress={() => setIsPlaylistOpen(false)} style={styles.closePlaylistButton}>
									<AntDesign name="close" size={20} color="#e75480" />
								</TouchableOpacity>
							</View>
						</View>

						{/* Playlist Info */}
						{playlist.length > 0 && (
							<View style={styles.playlistInfo}>
								<Text style={styles.playlistInfoText}>
									{currentSong && playlist.findIndex(s => s.trackId === currentSong.trackId) >= 0 
										? `Playing ${playlist.findIndex(s => s.trackId === currentSong.trackId) + 1} of ${playlist.length}`
										: `Ready to play ${playlist.length} songs`
									}
								</Text>
							</View>
						)}

						{/* Playlist Songs */}
						<FlatList
							data={playlist}
							keyExtractor={item => item.trackId.toString()}
							renderItem={({ item }) => (
								<View style={styles.playlistSongItem}>
									<TouchableOpacity onPress={() => playFromPlaylist(item)} style={styles.playlistSongInfo}>
										<Text style={styles.songTitle}>{item.trackName}</Text>
										<Text style={styles.songArtist}>{item.artistName}</Text>
										{playingId === item.trackId && <Text style={{ color: 'green' }}>Playing...</Text>}
									</TouchableOpacity>
									<TouchableOpacity 
										onPress={() => removeFromPlaylist(item.trackId)}
										style={styles.removeFromPlaylistButton}
									>
										<AntDesign name="delete" size={20} color="#e75480" />
									</TouchableOpacity>
								</View>
							)}
							ListEmptyComponent={
								<View style={styles.emptyPlaylist}>
									<Text style={styles.emptyPlaylistText}>Your playlist is empty</Text>
									<Text style={styles.emptyPlaylistSubtext}>Search for songs and add them to your playlist</Text>
								</View>
							}
						/>
					</LinearGradient>
				</SafeAreaView>
			</Modal>
		</View>
	);
}

const Dev_Height = Dimensions.get('window').height;
const Dev_Width = Dimensions.get('window').width;

const styles = StyleSheet.create({
	gradientBackground: {
		flex: 1,
		width: '100%',
	},
	contentContainer: {
		flex: 1, 
		padding: 16, 
		paddingTop: 40, 
		paddingBottom: 16,
	},
	input: {
		borderWidth: 1,
		borderColor: 'rgba(255,255,255,0.3)',
		borderRadius: 8,
		padding: 8,
		marginBottom: 8,
		backgroundColor: 'rgba(255,255,255,0.15)',
		color: '#fff',
	},
	songItem: {
		padding: 12,
		borderBottomWidth: 1,
		borderColor: 'rgba(255,255,255,0.1)',
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		backgroundColor: 'rgba(0,0,0,0.1)',
		marginBottom: 8,
		borderRadius: 8,
	},
	songInfo: {
		flex: 1,
	},
	songTitle: { fontWeight: 'bold', color: '#fff', fontSize: 16 },
	songArtist: { color: 'rgba(255,255,255,0.8)' },
	playlistButton: {
		paddingVertical: 8,
		paddingHorizontal: 12,
		borderRadius: 6,
		borderWidth: 1,
		borderColor: '#e75480',
		backgroundColor: '#fff',
		minWidth: 60,
		alignItems: 'center',
		justifyContent: 'center',
		marginLeft: 10,
	},
	playlistButtonText: {
		color: '#e75480',
		fontSize: 14,
		fontWeight: 'bold',
	},
	removeButton: {
		backgroundColor: '#e75480',
		borderColor: '#e75480',
	},
	removeButtonText: {
		color: '#fff',
	},

	bottomPanel: {
		position: 'absolute',
		left: 16,
		right: 16,
		bottom: 16,
		borderRadius: 8,
		elevation: 8,
		height: 64,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: -2 },
		shadowOpacity: 0.2,
		shadowRadius: 4,
		overflow: 'hidden',
	},
	closeButton: {
		marginLeft: 10,
		backgroundColor: 'rgba(255,255,255,0.2)',
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
	modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
	playerModal: { borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 24, alignItems: 'center', minHeight: Dev_Height * 0.7, width: Dev_Width },
	mainbar: { height: 50, width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
	nowPlayingText: { fontSize: 19, fontWeight: 'bold', textAlign: 'center', flex: 1, color: '#fff' },
	musicLogoView: { height: '30%', width: '100%', justifyContent: 'center', alignItems: 'center' },
	imageView: { height: 180, width: 180, borderRadius: 10, backgroundColor: '#eee' },
	songInfoView: { height: 70, width: '100%', alignItems: 'center', justifyContent: 'center', marginVertical: 10 },
	sliderView: { height: 50, width: '100%', alignItems: 'center', flexDirection: 'row', marginVertical: 10 },
	sliderStyle: { height: 40, width: '60%' },
	sliderTime: { fontSize: 15, marginLeft: 16, marginRight: 16, color: '#808080' },
	functionsView: { flexDirection: 'row', height: 60, width: '100%', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
	searchRow: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 8,
	},
	playlistCounter: {
		backgroundColor: 'rgba(231, 84, 128, 0.7)',
		paddingVertical: 5,
		paddingHorizontal: 10,
		borderRadius: 5,
		marginLeft: 10,
		borderWidth: 1,
		borderColor: 'rgba(255,255,255,0.3)',
	},
	playlistCounterText: {
		color: '#fff',
		fontSize: 14,
		fontWeight: 'bold',
	},
	playlistModal: { borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 24, alignItems: 'center', minHeight: Dev_Height * 0.7, width: Dev_Width },
	clearPlaylistText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
	playlistHeaderButtons: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	clearPlaylistButton: {
		marginRight: 10,
	},
	closePlaylistButton: {
		padding: 5,
	},
	playlistSongItem: {
		padding: 12,
		borderBottomWidth: 1,
		borderColor: 'rgba(255,255,255,0.1)',
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		width: '100%',
		backgroundColor: 'rgba(0,0,0,0.1)',
		marginBottom: 8,
		borderRadius: 8,
	},
	playlistSongInfo: {
		flex: 1,
	},
	removeFromPlaylistButton: {
		padding: 5,
	},
	emptyPlaylist: {
		padding: 20,
		alignItems: 'center',
	},
	emptyPlaylistText: {
		fontSize: 18,
		fontWeight: 'bold',
		color: '#fff',
		marginBottom: 10,
	},
	emptyPlaylistSubtext: {
		fontSize: 14,
		color: 'rgba(255,255,255,0.7)',
		textAlign: 'center',
	},
	playlistInfo: {
		paddingVertical: 10,
		paddingHorizontal: 20,
		backgroundColor: 'rgba(0,0,0,0.2)',
		borderRadius: 8,
		marginTop: 10,
		marginBottom: 10,
	},
	playlistInfoText: {
		fontSize: 14,
		color: '#fff',
		textAlign: 'center',
	},
});
