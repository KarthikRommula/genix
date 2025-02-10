// Database configuration
let db;
const DB_NAME = 'MusicPlayerDB';
const DB_VERSION = 2; // Incremented for hash index
const STORE_NAME = 'songs';

// DOM Elements
const image = document.getElementById('cover');
const title = document.getElementById('music-title');
const artist = document.getElementById('music-artist');
const currentTimeEl = document.getElementById('current-time');
const durationEl = document.getElementById('duration');
const progress = document.getElementById('progress');
const playerProgress = document.getElementById('player-progress');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const playBtn = document.getElementById('play');
const background = document.getElementById('bg-img');
const shuffleBtn = document.getElementById('shuffle');
const playlistBtn = document.getElementById('playlist');

// Audio initialization
const music = new Audio();

// Default songs
const defaultSongs = [
    {
        path: 'songs/1.mp3',
        displayName: 'The Charmer\'s Call',
        cover: 'songs/2.jpg',
        artist: 'Hanu Dixit',
    },
];

// Initialize songs array with default songs
let songs = [...defaultSongs];
let musicIndex = 0;
let isPlaying = false;
let queue = [];
// Database Functions
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                store.createIndex('displayName', 'displayName', { unique: false });
                store.createIndex('artist', 'artist', { unique: false });
                store.createIndex('hash', 'hash', { unique: true });
            } else if (event.oldVersion < 2) {
                const store = event.target.transaction.objectStore(STORE_NAME);
                if (!store.indexNames.contains('hash')) {
                    store.createIndex('hash', 'hash', { unique: true });
                }
            }
        };
    });
}
function addToQueue(song) {
    if (!song) return;
    queue.push({...song}); // Create copy to avoid reference issues
    showNotification('Added to queue: ' + song.displayName, 'success');
    displayQueue();
}
function removeFromQueue(index) {
    queue.splice(index, 1);
    displayQueue();
}
function playNext() {
    if (queue.length > 0) {
        const nextSong = queue.shift();
        const songIndex = songs.findIndex(song => 
            song.id === nextSong.id || 
            (song.path === nextSong.path && song.displayName === nextSong.displayName)
        );
        
        if (songIndex !== -1) {
            musicIndex = songIndex;
            loadMusic(songs[musicIndex]);
            playMusic();
        }
        displayQueue();
    } else {
        changeMusic(1);
    }
}
music.addEventListener('ended', playNext);
async function loadSongsFromDB() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            const dbSongs = request.result;
            songs = [...defaultSongs, ...dbSongs];
            resolve(songs);
        };

        request.onerror = () => reject(request.error);
    });
}

async function storeSong(song) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.add(song);

        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => {
            if (request.error.name === 'ConstraintError') {
                reject(new Error('This song has already been uploaded.'));
            } else {
                reject(request.error);
            }
        };
    });
}

async function deleteSong(songId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(songId);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Player Functions
function togglePlay() {
    if (isPlaying) {
        pauseMusic();
    } else {
        playMusic();
    }
}

function playMusic() {
    isPlaying = true;
    playBtn.classList.replace('fa-play', 'fa-pause');
    playBtn.setAttribute('title', 'Pause');
    music.play();
}

function pauseMusic() {
    isPlaying = false;
    playBtn.classList.replace('fa-pause', 'fa-play');
    playBtn.setAttribute('title', 'Play');
    music.pause();
}
function loadMusic(song) {
    music.src = song.path;
    title.textContent = song.displayName;
    artist.textContent = song.artist;
    image.src = song.cover;
    background.src = song.cover;
    updateMediaSession(song);
}

function changeMusic(direction) {
    musicIndex = (musicIndex + direction + songs.length) % songs.length;
    loadMusic(songs[musicIndex]);
    playMusic();
}

function updateProgressBar() {
    const { duration, currentTime } = music;
    if (isNaN(duration)) return;
    
    const progressPercent = (currentTime / duration) * 100;
    progress.style.width = `${progressPercent}%`;

    const formatTime = (time) => String(Math.floor(time)).padStart(2, '0');
    durationEl.textContent = `${formatTime(duration / 60)}:${formatTime(duration % 60)}`;
    currentTimeEl.textContent = `${formatTime(currentTime / 60)}:${formatTime(currentTime % 60)}`;
}

function setProgressBar(e) {
    const width = playerProgress.clientWidth;
    const clickX = e.offsetX;
    music.currentTime = (clickX / width) * music.duration;
}

// Playlist Functions
const playlistModal = document.createElement('div');
playlistModal.id = 'playlist-modal';
playlistModal.innerHTML = `
    <div class="playlist-content">
        <span id="close-playlist" class="close-playlist"><i class="fas fa-times"></i></span>
        <h2><i class="fas fa-music"></i> Playlist</h2>
        <ul id="playlist-container"></ul>
        <button id="upload"><i class="fas fa-upload"></i></button>
    </div>
`;
document.body.appendChild(playlistModal);

const playlistContainer = document.getElementById('playlist-container');
const closePlaylistBtn = document.getElementById('close-playlist');
const uploadBtn = document.getElementById('upload');

function displayPlaylist() {
    if (!playlistContainer) return;
    playlistContainer.innerHTML = '';

    // Display songs
    songs.forEach((song, index) => {
        const songItem = document.createElement('li');
        const songTitle = document.createElement('span');
        songTitle.textContent = `${song.displayName} - ${song.artist}`;
        songItem.appendChild(songTitle);

        songTitle.addEventListener('click', () => {
            musicIndex = index;
            loadMusic(songs[index]);
            playMusic();
            togglePlaylist();
        });

        const queueBtn = document.createElement('button');
        queueBtn.innerHTML = '<i class="fas fa-plus"></i>';
        queueBtn.className = 'add-to-queue';
        queueBtn.title = 'Add to Queue';
        queueBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            addToQueue(song);
        });
        songItem.appendChild(queueBtn);

        if (song.id) {
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteBtn.className = 'delete-song';
            deleteBtn.title = 'Delete Song';
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (await showConfirmDialog('Are you sure you want to delete this song?')) {
                    try {
                        await deleteSong(song.id);
                        await loadSongsFromDB();
                        displayPlaylist();
                        if (musicIndex === index) {
                            musicIndex = 0;
                            loadMusic(songs[0]);
                            if (isPlaying) playMusic();
                        }
                        showNotification('Song deleted successfully', 'success');
                    } catch (error) {
                        console.error('Error deleting song:', error);
                        showNotification('Error deleting song. Please try again.', 'error');
                    }
                }
            });
            songItem.appendChild(deleteBtn);
        }

        playlistContainer.appendChild(songItem);
    });

    // Display queue separately
    displayQueue();
}
function togglePlaylist() {
    playlistModal.classList.toggle('open');
    if (playlistModal.classList.contains('open')) {
        displayPlaylist();
    }
}

// File handling functions
async function calculateFileHash(file) {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function checkSongExists(songName, hash) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);

        const hashIndex = store.index('hash');
        const hashRequest = hashIndex.count(hash);

        hashRequest.onsuccess = () => {
            if (hashRequest.result > 0) {
                resolve({ exists: true, reason: 'content' });
                return;
            }

            const nameIndex = store.index('displayName');
            const nameRequest = nameIndex.count(songName);

            nameRequest.onsuccess = () => {
                resolve({ exists: nameRequest.result > 0, reason: 'name' });
            };
            nameRequest.onerror = () => reject(nameRequest.error);
        };

        hashRequest.onerror = () => reject(hashRequest.error);
    });
}

async function handleFileUpload(event) {
    const files = Array.from(event.target.files); // Convert FileList to an array
    if (files.length === 0) {
        showNotification('Please upload valid audio files.', 'error');
        return;
    }

    for (const file of files) {
        if (!file.type.startsWith('audio/')) {
            showNotification(`Skipping invalid file: ${file.name}. Please upload a valid audio file.`, 'error');
            continue;
        }

        try {
            const hash = await calculateFileHash(file);
            const songName = file.name.replace(/\.[^/.]+$/, '');

            const { exists, reason } = await checkSongExists(songName, hash);
            if (exists) {
                showNotification(
                    reason === 'content'
                        ? `Skipping duplicate song: ${songName} (already uploaded).`
                        : `Skipping song: ${songName} (a song with this name already exists).`,
                    'error'
                );
                continue;
            }

            const reader = new FileReader();
            reader.onload = async function () {
                const newSong = {
                    path: reader.result,
                    displayName: songName,
                    cover: 'songs/2.jpg',
                    artist: 'Unknown Artist',
                    uploadDate: new Date().toISOString(),
                    hash: hash
                };

                await storeSong(newSong);
                await loadSongsFromDB();
                showNotification(`Song uploaded successfully: ${songName}`, 'success');
                displayPlaylist();
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error(`Error uploading song ${file.name}:`, error);
            showNotification(`Error uploading song: ${file.name}. Please try again.`, 'error');
        }
    }
}

// Notification Functions
function showConfirmDialog(message) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'notification-overlay';

        const dialog = document.createElement('div');
        dialog.className = 'notification-dialog';

        const messageText = document.createElement('p');
        messageText.textContent = message;

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'notification-buttons';

        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'notification-btn confirm-btn';
        confirmBtn.textContent = 'Confirm';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'notification-btn cancel-btn';
        cancelBtn.textContent = 'Cancel';

        buttonContainer.appendChild(confirmBtn);
        buttonContainer.appendChild(cancelBtn);
        dialog.appendChild(messageText);
        dialog.appendChild(buttonContainer);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        const closeDialog = (result) => {
            overlay.classList.add('fade-out');
            setTimeout(() => {
                overlay.remove();
                resolve(result);
            }, 300);
        };

        confirmBtn.addEventListener('click', () => closeDialog(true));
        cancelBtn.addEventListener('click', () => closeDialog(false));
    });
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;

    const icon = document.createElement('span');
    icon.className = 'notification-icon';
    icon.innerHTML = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';

    const text = document.createElement('span');
    text.textContent = message;

    notification.appendChild(icon);
    notification.appendChild(text);
    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 10);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Shuffle Function
function shuffleSongs() {
    const currentSong = songs[musicIndex];
    const remainingSongs = songs.filter((_, index) => index !== musicIndex);
    
    for (let i = remainingSongs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remainingSongs[i], remainingSongs[j]] = [remainingSongs[j], remainingSongs[i]];
    }
    
    songs = [currentSong, ...remainingSongs];
    musicIndex = 0;
    displayPlaylist();
}

// Event Listeners
playBtn.addEventListener('click', togglePlay);
prevBtn.addEventListener('click', () => changeMusic(-1));
nextBtn.addEventListener('click', () => changeMusic(1));
music.addEventListener('ended', () => changeMusic(1));
music.addEventListener('timeupdate', updateProgressBar);
playerProgress.addEventListener('click', setProgressBar);
closePlaylistBtn.addEventListener('click', togglePlaylist);
playlistBtn.addEventListener('click', togglePlaylist);
shuffleBtn.addEventListener('click', shuffleSongs);

uploadBtn.addEventListener('click', () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'audio/*';
    fileInput.multiple = true; // Allow multiple file selections
    fileInput.addEventListener('change', handleFileUpload);
    fileInput.click();
});
// Initialize application
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initDB();
        await loadSongsFromDB();
        loadMusic(songs[musicIndex]);
    } catch (error) {
        console.error('Error initializing database:', error);
        showNotification('Error loading songs. Please refresh the page.', 'error');
    }
});
window.onload = () => {
    document.addEventListener("keydown", (event) => {
        if (event.key === " ") {
            event.preventDefault();
            togglePlay();
        } else if (event.key === "ArrowRight") {
            event.preventDefault();
            changeMusic(1);
        } else if (event.key === "ArrowLeft") {
            event.preventDefault();
            changeMusic(-1);
        }
    });
};
function updateMediaSession(song) {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: song.displayName,
            artist: song.artist,
            artwork: [{ src: song.cover, sizes: "512x512", type: "image/jpeg" }]
        });

        navigator.mediaSession.setActionHandler("play", playMusic);
        navigator.mediaSession.setActionHandler("pause", pauseMusic);
        navigator.mediaSession.setActionHandler("nexttrack", () => changeMusic(1));
        navigator.mediaSession.setActionHandler("previoustrack", () => changeMusic(-1));
    }
}