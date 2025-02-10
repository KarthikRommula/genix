// Database configuration
let db;
const DB_NAME = 'MusicPlayerDB';
const DB_VERSION = 1;
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
            }
        };
    });
}

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
        request.onerror = () => reject(request.error);
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
}

function changeMusic(direction) {
    musicIndex = (musicIndex + direction + songs.length) % songs.length;
    loadMusic(songs[musicIndex]);
    playMusic();
}

function updateProgressBar() {
    const { duration, currentTime } = music;
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
const playlistBtn = document.getElementById('playlist');
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
    playlistContainer.innerHTML = '';

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

        if (song.id) {
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteBtn.className = 'delete-song';
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();

                // Use custom confirm dialog instead of default confirm
                const confirmed = await showConfirmDialog('Are you sure you want to delete this song?');

                if (confirmed) {
                    try {
                        await deleteSong(song.id);
                        await loadSongsFromDB();
                        displayPlaylist();

                        if (musicIndex === index) {
                            musicIndex = 0;
                            loadMusic(songs[0]);
                            if (isPlaying) playMusic();
                        }

                        // Show success notification
                        showNotification('Song deleted successfully', 'success');
                    } catch (error) {
                        console.error('Error deleting song:', error);
                        // Show error notification
                        showNotification('Error deleting song. Please try again.', 'error');
                    }
                }
            });
            songItem.appendChild(deleteBtn);
        }

        playlistContainer.appendChild(songItem);
    });
}

function togglePlaylist() {
    playlistModal.classList.toggle('open');
    if (playlistModal.classList.contains('open')) {
        displayPlaylist();
    }
}

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('audio/')) {
        try {
            const reader = new FileReader();
            reader.onload = async function () {
                const newSong = {
                    path: reader.result,
                    displayName: file.name.replace(/\.[^/.]+$/, ''),
                    cover: 'songs/2.jpg',
                    artist: 'Unknown Artist',
                    uploadDate: new Date().toISOString()
                };

                await storeSong(newSong);
                await loadSongsFromDB();
                alert('Song uploaded successfully!');
                displayPlaylist();
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Error uploading song:', error);
            alert('Error uploading song. Please try again.');
        }
    } else {
        alert('Please upload a valid audio file.');
    }
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
uploadBtn.addEventListener('click', function () {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'audio/*';
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
        alert('Error loading songs. Please refresh the page.');
    }
});
// Add file hash function for checking duplicates
async function calculateFileHash(file) {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Modify database initialization to include hash index
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION + 1); // Increment version to trigger upgrade

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
                store.createIndex('hash', 'hash', { unique: true }); // Add hash index
            } else {
                // Add hash index to existing store if upgrading from previous version
                const store = event.target.transaction.objectStore(STORE_NAME);
                if (!store.indexNames.contains('hash')) {
                    store.createIndex('hash', 'hash', { unique: true });
                }
            }
        };
    });
}

// Function to check if song exists
async function checkSongExists(songName, hash) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);

        // First check by hash
        const hashIndex = store.index('hash');
        const hashRequest = hashIndex.count(hash);

        hashRequest.onsuccess = () => {
            if (hashRequest.result > 0) {
                resolve({ exists: true, reason: 'content' });
                return;
            }

            // Then check by name
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

// Modified upload handler
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file || !file.type.startsWith('audio/')) {
        alert('Please upload a valid audio file.');
        return;
    }

    try {
        // Calculate file hash
        const hash = await calculateFileHash(file);
        const songName = file.name.replace(/\.[^/.]+$/, '');

        // Check if song exists
        const { exists, reason } = await checkSongExists(songName, hash);
        if (exists) {
            showNotification(reason === 'content'
                ? 'This song has already been uploaded.'
                : 'A song with this name already exists. Please rename the file and try again.');
            return;
        }

        // Proceed with upload if song doesn't exist
        const reader = new FileReader();
        reader.onload = async function () {
            const newSong = {
                path: reader.result,
                displayName: songName,
                cover: 'songs/2.jpg',
                artist: 'Unknown Artist',
                uploadDate: new Date().toISOString(),
                hash: hash // Store hash with song data
            };

            await storeSong(newSong);
            await loadSongsFromDB();
            showNotification('Song uploaded successfully!');
            displayPlaylist();
        };
        reader.readAsDataURL(file);
    } catch (error) {
        console.error('Error uploading song:', error);
        alert('Error uploading song. Please try again.');
    }
}

// Modified store function to handle unique constraint errors
async function storeSong(song) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.add(song);

        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => {
            // Check if error is due to duplicate hash
            if (request.error.name === 'ConstraintError') {
                reject(new Error('This song has already been uploaded.'));
            } else {
                reject(request.error);
            }
        };
    });
}

// notifications.js
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
    
    // Trigger animation
    setTimeout(() => notification.classList.add('show'), 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add styles to document
const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);