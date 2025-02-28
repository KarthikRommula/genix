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
        cover: 'songs/optimized_pic.jpg',
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
function displayQueue() {
    let queueSection = document.getElementById('queue-section');
    if (!queueSection) {
        queueSection = document.createElement('div');
        queueSection.id = 'queue-section';
        queueSection.innerHTML = `
            <div class="queue-header">
                <h3>Queue</h3>
                <span class="queue-subtitle" >Next in queue what </span>
            </div>
        `;
        playlistContainer.parentNode.insertBefore(queueSection, playlistContainer.nextSibling);
    }

    queueSection.innerHTML = `
        <div class="queue-header">
            <h3>Queue</h3>
            <span class="queue-subtitle">Next in queue what</span>
        </div>
    `;

    if (queue.length > 0) {
        const queueList = document.createElement('ul');
        queueList.id = 'queue-list';

        queue.forEach((song, index) => {
            const queueItem = document.createElement('li');
            queueItem.innerHTML = `
                <div class="queue-item">
                    <div class="queue-item-info">
                        <img src="${song.cover}" alt="cover" class="queue-cover">
                        <div class="queue-text">
                            <span class="queue-title">${song.displayName}</span>
                            <span class="queue-artist">${song.artist}</span>
                        </div>
                    </div>
                    <button class="remove-from-queue" title="Remove">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;

            const removeBtn = queueItem.querySelector('.remove-from-queue');
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeFromQueue(index);
            });

            queueList.appendChild(queueItem);
        });

        queueSection.appendChild(queueList);
    } else {
        const emptyMessage = document.createElement('p');
        emptyMessage.className = 'empty-queue';
        emptyMessage.textContent = 'Your queue is empty';
        queueSection.appendChild(emptyMessage);
    }
}


function addToQueue(song) {
    if (!song) return;
    queue.push({ ...song });
    showNotification('Added to queue: ' + song.displayName, 'success');
    displayQueue();
}


function removeFromQueue(index) {
    queue.splice(index, 1);
    displayQueue();
}
function playNext() {
    if (queue.length > 0) {
        // Priority to manually queued songs
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
    } else {
        // If no songs in queue, play next in playlist
        changeMusic(1);
    }
    displayQueue();
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
    if (direction > 0 && queue.length > 0) {
        // Play from queue if going forward
        playNext();
    } else {
        // Normal playlist navigation
        musicIndex = (musicIndex + direction + songs.length) % songs.length;
        loadMusic(songs[musicIndex]);
        playMusic();
    }
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
        <h2> Playlist</h2>
        <ul id="playlist-container"></ul>
        <button id="upload">+</button>
    </div>
`;
document.body.appendChild(playlistModal);

const playlistContainer = document.getElementById('playlist-container');
const closePlaylistBtn = document.getElementById('close-playlist');
const uploadBtn = document.getElementById('upload');


// Add this function to create and style the search bar
function createSearchBar() {
    const searchContainer = document.createElement('div');
    searchContainer.className = 'search-container';
    searchContainer.innerHTML = `
        <div class="search-input-container">
            <i class="fas fa-search search-icon"></i>
            <input type="text" id="playlist-search" placeholder="Search in playlist" class="search-input">
            <button id="clear-search" class="clear-search-btn">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    // Insert the search bar before the playlist container
    const playlistContent = document.querySelector('.playlist-content');
    playlistContent.insertBefore(searchContainer, playlistContent.querySelector('h2').nextSibling);
    
    // Add event listeners for search functionality
    const searchInput = document.getElementById('playlist-search');
    const clearButton = document.getElementById('clear-search');
    
    // Show/hide clear button based on input content
    searchInput.addEventListener('input', () => {
        if (searchInput.value.length > 0) {
            clearButton.style.display = 'flex';
            filterPlaylist(searchInput.value);
        } else {
            clearButton.style.display = 'none';
            displayPlaylist(); // Reset to show all songs
        }
    });
    
    // Clear search functionality
    clearButton.addEventListener('click', () => {
        searchInput.value = '';
        clearButton.style.display = 'none';
        displayPlaylist(); // Reset to show all songs
        searchInput.focus();
    });
    
    // Initially hide the clear button
    clearButton.style.display = 'none';
}

// Add this function to filter the playlist based on search term
function filterPlaylist(searchTerm) {
    if (!playlistContainer) return;
    playlistContainer.innerHTML = '';
    
    // Convert search term to lowercase for case-insensitive search
    const searchLower = searchTerm.toLowerCase();
    
    // Filter songs based on search term
    const filteredSongs = songs.filter(song => 
        song.displayName.toLowerCase().includes(searchLower) || 
        song.artist.toLowerCase().includes(searchLower)
    );
    
    // Display filtered songs
    if (filteredSongs.length === 0) {
        // No results found
        const noResults = document.createElement('div');
        noResults.className = 'no-search-results';
        noResults.innerHTML = `
            <div class="no-results-icon"><i class="fas fa-search"></i></div>
            <p class="no-results-text">No songs found for "${searchTerm}"</p>
          
        `;
        playlistContainer.appendChild(noResults);
    } else {
        // Create songs list with filtered results
        const songsList = document.createElement('ul');
        songsList.id = 'queue-list';
        
        filteredSongs.forEach((song, index) => {
            const originalIndex = songs.findIndex(s => 
                (s.id && s.id === song.id) || 
                (s.path === song.path && s.displayName === song.displayName)
            );
            
            const songItem = document.createElement('li');
            songItem.className = 'queue-item';
            
            // Create song info container
            const songInfoDiv = document.createElement('div');
            songInfoDiv.className = 'queue-item-info';
            
            // Add cover image
            const coverImg = document.createElement('img');
            coverImg.src = song.cover || 'songs/optimized_pic.jpg';
            coverImg.className = 'queue-cover';
            coverImg.alt = `${song.displayName} cover`;
            songInfoDiv.appendChild(coverImg);
            
            // Create text container
            const textDiv = document.createElement('div');
            textDiv.className = 'queue-text';
            
            // Add title with highlighted search term
            const titleSpan = document.createElement('span');
            titleSpan.className = 'queue-title';
            titleSpan.innerHTML = highlightSearchTerm(song.displayName, searchTerm);
            
            // Add artist with highlighted search term
            const artistSpan = document.createElement('span');
            artistSpan.className = 'queue-artist';
            artistSpan.innerHTML = highlightSearchTerm(song.artist, searchTerm);
            
            textDiv.appendChild(titleSpan);
            textDiv.appendChild(artistSpan);
            songInfoDiv.appendChild(textDiv);
            
            // Add click event for playing
            songInfoDiv.addEventListener('click', () => {
                musicIndex = originalIndex;
                loadMusic(songs[originalIndex]);
                playMusic();
                togglePlaylist();
            });
            
            songItem.appendChild(songInfoDiv);
            
            // Create buttons container
            const buttonsDiv = document.createElement('div');
            buttonsDiv.className = 'queue-item-buttons';
            
            // Add to queue button
            const queueBtn = document.createElement('button');
            queueBtn.innerHTML = '<i class="fas fa-plus"></i>';
            queueBtn.className = 'remove-from-queue';
            queueBtn.title = 'Add to Queue';
            queueBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                addToQueue(song);
            });
            buttonsDiv.appendChild(queueBtn);
            
            // Delete button (if song has ID)
            if (song?.id) {
                const deleteBtn = document.createElement('button');
                deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
                deleteBtn.className = 'remove-from-queue';
                deleteBtn.title = 'Delete Song';
                
                deleteBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    
                    const userConfirmed = await showConfirmDialog('Are you sure you want to delete this song?');
                    if (!userConfirmed) return;
                    
                    try {
                        await deleteSong(song.id);
                        await loadSongsFromDB();
                        filterPlaylist(searchTerm); // Re-filter the playlist after deletion
                        
                        if (musicIndex === originalIndex) {
                            musicIndex = 0;
                            loadMusic(songs[0] || null);
                            if (isPlaying && songs.length > 0) playMusic();
                        }
                        
                        showNotification('Song deleted successfully', 'success');
                    } catch (error) {
                        console.error('Error deleting song:', error);
                        showNotification('Error deleting song. Please try again.', 'error');
                    }
                });
                
                buttonsDiv.appendChild(deleteBtn);
            }
            
            songItem.appendChild(buttonsDiv);
            songsList.appendChild(songItem);
        });
        
        playlistContainer.appendChild(songsList);
    }
}

// Helper function to highlight search term in text
function highlightSearchTerm(text, searchTerm) {
    if (!searchTerm) return text;
    
    const searchRegex = new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi');
    return text.replace(searchRegex, '<span class="highlight">$1</span>');
}

// Helper function to escape special characters in regex
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Update the togglePlaylist function to initialize the search bar
const originalTogglePlaylist = togglePlaylist;
togglePlaylist = function() {
    originalTogglePlaylist();
    
    if (playlistModal.classList.contains('open')) {
        // Check if search bar already exists
        if (!document.querySelector('.search-container')) {
            createSearchBar();
        }
    }
};

// Add styles for search bar and highlighted text
const searchStyles = document.createElement('style');
searchStyles.textContent = `
    .search-container {
        padding: 16px 16px 8px;
       
        top: 0;
        z-index: 10;
        background-color:transparent;
    }
    
    .search-input-container {
        position: relative;
        display: flex;
        align-items: center;
        background-color: #333;
        border-radius: 4px;
        overflow: hidden;
    }
    
    .search-icon {
        position: absolute;
        left: 12px;
        color: #b3b3b3;
    }
    
    .search-input {
        width: 100%;
        background-color: #333;
        border: none;
        padding: 10px 40px 10px 36px;
        color: white;
        font-size: 14px;
    }
    
    .search-input:focus {
        outline: none;
        box-shadow: 0 0 0 2px rgba(29, 185, 84, 0.5);
    }
    
    .search-input::placeholder {
        color: #b3b3b3;
    }
    
    .clear-search-btn {
        position: absolute;
        right: 8px;
        background: none;
        border: none;
        color: #b3b3b3;
        cursor: pointer;
        padding: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .clear-search-btn:hover {
        color: white;
    }
    
    .highlight {
        background-color: rgba(29, 185, 84, 0.3);
        border-radius: 2px;
    }
    
    .no-search-results {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 20px;
        color: #b3b3b3;
        text-align: center;
    }
    
    .no-results-icon {
        font-size: 32px;
        margin-bottom: 16px;
        color: #b3b3b3;
    }
    
    .no-results-text {
        font-size: 16px;
        margin-bottom: 8px;
        color: white;
    }
    
    .no-results-subtext {
        font-size: 14px;
        color: #b3b3b3;
    }
    
  
`;

document.head.appendChild(searchStyles);
function displayPlaylist() {
    if (!playlistContainer) return;
    playlistContainer.innerHTML = '';

    // Create main playlist section
    const playlistSection = document.createElement('div');
    playlistSection.id = 'playlist-section';
    
    // Add a fixed height with scrolling to the playlist section
    playlistSection.style.maxHeight = '300px'; // Adjust height as needed
    playlistSection.style.overflowY = 'auto';
    playlistSection.style.overflowX = 'hidden';

    // Display songs title
    const playlistHeader = document.createElement('div');
    playlistHeader.className = 'playlist-header';
    
    const playlistTitle = document.createElement('h3');
    playlistTitle.textContent = '';
    playlistHeader.appendChild(playlistTitle);
    playlistSection.appendChild(playlistHeader);

    // Display songs
    const songsList = document.createElement('ul');
    songsList.id = 'queue-list';

    songs.forEach((song, index) => {
        const songItem = document.createElement('li');
        songItem.className = 'queue-item';
        
        // Highlight currently playing song with Spotify-like animation indicator
        if (index === musicIndex && isPlaying) {
            songItem.classList.add('currently-playing');
            
            // Create Spotify-like playing indicator (animated equalizer bars)
            const playingIndicator = document.createElement('div');
            playingIndicator.className = 'spotify-playing-indicator';
            
            // Create the equalizer bars (Spotify has 3 animated bars)
            for (let i = 0; i < 3; i++) {
                const bar = document.createElement('span');
                bar.className = 'equalizer-bar';
                playingIndicator.appendChild(bar);
            }
            
            // Add the indicator to the song item
            songItem.appendChild(playingIndicator);
        }

        // Create song info container
        const songInfoDiv = document.createElement('div');
        songInfoDiv.className = 'queue-item-info';

        // Add cover image if available
        const coverImg = document.createElement('img');
        coverImg.src = song.coverUrl || '/songs/optimized_pic.jpg'; // Add a default cover image path
        coverImg.className = 'queue-cover';
        coverImg.alt = `${song.displayName} cover`;
        songInfoDiv.appendChild(coverImg);
        
        // Create text container
        const textDiv = document.createElement('div');
        textDiv.className = 'queue-text';

        // Add title - brighten text color if currently playing (Spotify style)
        const titleSpan = document.createElement('span');
        titleSpan.className = 'queue-title';
        titleSpan.textContent = song.displayName;
        if (index === musicIndex && isPlaying) {
            titleSpan.style.color = '#fff'; // Brighter text for playing song (Spotify style)
        }

        // Add artist
        const artistSpan = document.createElement('span');
        artistSpan.className = 'queue-artist';
        artistSpan.textContent = song.artist;

        textDiv.appendChild(titleSpan);
        textDiv.appendChild(artistSpan);
        songInfoDiv.appendChild(textDiv);

        // Add click event for playing
        songInfoDiv.addEventListener('click', () => {
            musicIndex = index;
            loadMusic(songs[index]);
            playMusic();
            togglePlaylist();
        });

        songItem.appendChild(songInfoDiv);

        // Create buttons container
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'queue-item-buttons';

        // Add to queue button
        const queueBtn = document.createElement('button');
        queueBtn.innerHTML = '<i class="fas fa-plus"></i>';
        queueBtn.className = 'remove-from-queue';
        queueBtn.title = 'Add to Queue';
        queueBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            addToQueue(song);
        });
        buttonsDiv.appendChild(queueBtn);

        // Delete button (if song has ID)
        if (song?.id) {
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteBtn.className = 'remove-from-queue';
            deleteBtn.title = 'Delete Song';

            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();

                const userConfirmed = await showConfirmDialog('Are you sure you want to delete this song?');
                if (!userConfirmed) return;

                try {
                    await deleteSong(song.id);
                    await loadSongsFromDB();
                    displayPlaylist();

                    if (musicIndex === index) {
                        musicIndex = 0;
                        loadMusic(songs[0] || null);
                        if (isPlaying && songs.length > 0) playMusic();
                    }

                    showNotification('Song deleted successfully', 'success');
                } catch (error) {
                    console.error('Error deleting song:', error);
                    showNotification('Error deleting song. Please try again.', 'error');
                }
            });

            buttonsDiv.appendChild(deleteBtn);
        }

        songItem.appendChild(buttonsDiv);
        songsList.appendChild(songItem);
    });

    playlistSection.appendChild(songsList);
    playlistContainer.appendChild(playlistSection);

    // Create and display queue section
    const queueSection = document.createElement('div');
    queueSection.id = 'queue-section';
    
    // Add a fixed height with scrolling to the queue section as well
    queueSection.style.maxHeight = '300px'; 
    queueSection.style.overflowY = 'auto';
    queueSection.style.overflowX = 'hidden';

    const queueHeader = document.createElement('div');
    queueHeader.className = 'queue-header';

    const queueTitle = document.createElement('h3');
    queueTitle.textContent = 'Queue';

    const queueSubtitle = document.createElement('div');
    queueSubtitle.className = 'queue-subtitle';
    queueSubtitle.textContent = queue.length > 0 ? `${queue.length} song(s)` : '';

    queueHeader.appendChild(queueTitle);
    queueHeader.appendChild(queueSubtitle);
    queueSection.appendChild(queueHeader);

    // Display queue
    if (queue.length > 0) {
        const queueList = document.createElement('ul');
        queueList.id = 'queue-list';

        queue.forEach((song, index) => {
            const queueItem = document.createElement('li');
            queueItem.className = 'queue-item';

            // Create song info container
            const songInfoDiv = document.createElement('div');
            songInfoDiv.className = 'queue-item-info';

            // Add cover image if available
            const coverImg = document.createElement('img');
            coverImg.src = song.coverUrl || '/songs/optimized_pic.jpg';
            coverImg.className = 'queue-cover';
            coverImg.alt = `${song.displayName} cover`;
            songInfoDiv.appendChild(coverImg);

            // Create text container
            const textDiv = document.createElement('div');
            textDiv.className = 'queue-text';

            // Add title
            const titleSpan = document.createElement('span');
            titleSpan.className = 'queue-title';
            titleSpan.textContent = song.displayName;

            // Add artist
            const artistSpan = document.createElement('span');
            artistSpan.className = 'queue-artist';
            artistSpan.textContent = song.artist;

            textDiv.appendChild(titleSpan);
            textDiv.appendChild(artistSpan);
            songInfoDiv.appendChild(textDiv);

            // Add click event to play this queued song
            songInfoDiv.addEventListener('click', () => {
                // Remove the song from queue
                const songToPlay = queue.splice(index, 1)[0];
                // Play it immediately
                loadMusic(songToPlay);
                playMusic();
                // Refresh the display
                displayPlaylist();
            });

            queueItem.appendChild(songInfoDiv);

            // Create buttons container
            const buttonsDiv = document.createElement('div');
            buttonsDiv.className = 'queue-item-buttons';

            // Remove from queue button
            const removeBtn = document.createElement('button');
            removeBtn.innerHTML = '<i class="fas fa-times"></i>';
            removeBtn.className = 'remove-from-queue';
            removeBtn.title = 'Remove from Queue';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                queue.splice(index, 1);
                displayPlaylist();
                showNotification('Removed from queue', 'info');
            });
            buttonsDiv.appendChild(removeBtn);

            queueItem.appendChild(buttonsDiv);
            queueList.appendChild(queueItem);
        });

        queueSection.appendChild(queueList);
    } else {
        const emptyQueue = document.createElement('div');
        emptyQueue.className = 'empty-queue';
        emptyQueue.textContent = 'Your queue is empty';
        queueSection.appendChild(emptyQueue);
    }

    playlistContainer.appendChild(queueSection);
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
    const files = Array.from(event.target.files);
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

            // Remove [SPOTDOWNLOADER.COM] prefix from song name
            let songName = file.name.replace(/\.[^/.]+$/, '');
            songName = songName.replace(/^\[SPOTDOWNLOADER\.COM\]\s*/, '');
            songName = songName.replace(/\s*\(.*\)$/, '');

            const { exists, reason } = await checkSongExists(songName, hash);
            if (exists) {
                showNotification(
                    reason === 'content'
                        ? `Skipping duplicate song: ${songName}.`
                        : `Skipping duplicate song: ${songName} (same content).`,
                    'error'
                );
                continue;
            }

            const reader = new FileReader();
            reader.onload = async function () {
                const newSong = {
                    path: reader.result,
                    displayName: songName,
                    cover: 'songs/optimized_pic.jpg',
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
    // Create a context menu for upload options
    const uploadMenu = document.createElement('div');
    uploadMenu.className = 'upload-menu';
    uploadMenu.innerHTML = `
        <button id="upload-files">Upload Files</button>
        <button id="upload-folder">Upload Folder</button>
    `;
    
    // Position the menu near the upload button
    const rect = uploadBtn.getBoundingClientRect();
    uploadMenu.style.position = 'absolute';
    uploadMenu.style.top = `${rect.bottom + 5}px`;
    uploadMenu.style.left = `${rect.left}px`;
    uploadMenu.style.zIndex = '1000';
    
    document.body.appendChild(uploadMenu);
    
    // Handle file upload option
    document.getElementById('upload-files').addEventListener('click', () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'audio/*';
        fileInput.multiple = true;
        fileInput.addEventListener('change', handleFileUpload);
        fileInput.click();
        uploadMenu.remove();
    });
    
    // Handle folder upload option
    document.getElementById('upload-folder').addEventListener('click', () => {
        const folderInput = document.createElement('input');
        folderInput.type = 'file';
        folderInput.accept = 'audio/*';
        folderInput.multiple = true;
        folderInput.webkitdirectory = true; // This enables folder selection
        folderInput.addEventListener('change', handleFileUpload);
        folderInput.click();
        uploadMenu.remove();
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', function closeMenu(e) {
        if (!uploadMenu.contains(e.target) && e.target !== uploadBtn) {
            uploadMenu.remove();
            document.removeEventListener('click', closeMenu);
        }
    });
});

// Add styling for the upload menu (only once)
const menuStyle = document.createElement('style');
menuStyle.textContent = `
    .upload-menu {
        background-color: #282828;
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
        overflow: hidden;
        position: absolute;
        z-index: 1000;
    }
    
    .upload-menu button {
        display: block;
        width: 100%;
        padding: 10px 15px;
        text-align: left;
        background: none;
        border: none;
        color: #fff;
        cursor: pointer;
        transition: background-color 0.2s;
    }
    
    .upload-menu button:hover {
        background-color: rgba(255, 255, 255, 0.1);
    }
`;
document.head.appendChild(menuStyle);
document.head.appendChild(menuStyle);
document.head.appendChild(menuStyle);
document.head.appendChild(menuStyle);
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
const style = document.createElement('style');
style.textContent = `
    #queue-section {
        margin-top: 24px;
        padding: 0 16px;
        color: #fff;
    }

    .queue-header {
        margin-bottom: 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        padding-bottom: 8px;
        margin-top:5px
    }

    .queue-header h3 {
        font-size: 24px;
        margin: 0 0 4px 0;
    }

    .queue-subtitle {
        color:transparent;
        font-size: 0px;
    }

    #queue-list {
        list-style: none;
        padding: 0;
        margin: 0;
    }

    .queue-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px;
        border-radius: 4px;
        transition: background-color 0.2s;
    }

    .queue-item:hover {
        background-color: rgba(255, 255, 255, 0.1);
    }

    .queue-item-info {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .queue-cover {
        width: 40px;
        height: 40px;
        border-radius: 4px;
        object-fit: cover;
    }

    .queue-text {
        display: flex;
        flex-direction: column;
        
    }

    .queue-title {
        font-size: 14px;
        color: #fff;
        
    }

    .queue-artist {
        font-size: 0px;
        color:transparent;
        cursor: none;
    }

    .remove-from-queue {
        background: none;
        border: none;
        color: #b3b3b3;
        cursor: pointer;
        padding: 8px;
        opacity: 0;
        transition: opacity 0.2s;
    }

    .queue-item:hover .remove-from-queue {
        opacity: 1;
    }

    .remove-from-queue:hover {
        color: #fff;
    }

    .empty-queue {
        text-align: center;
        color: #b3b3b3;
        font-size: 14px;
        padding: 24px 0;
        margin-top:-20px
    }
`;

document.head.appendChild(style);

// Add this to your existing script.js file
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js', { scope: './' })
            .then((registration) => {
                console.log('ServiceWorker registration successful');
            })
            .catch((error) => {
                console.error('ServiceWorker registration failed:', error);
            });
    });
}

// Handle beforeinstallprompt event
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (event) => {
    // Prevent Chrome 67 and earlier from automatically showing the prompt
    event.preventDefault();
    // Stash the event so it can be triggered later
    deferredPrompt = event;
    // Update UI to notify the user they can add to home screen
    // You can show your custom install button here
});

// When you want to show the install prompt (e.g., user clicks an install button)
function showInstallPrompt() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
            }
            deferredPrompt = null;
        });
    }
}
// Add to your JavaScript
document.addEventListener('DOMContentLoaded', () => {
    // Preload images when needed
    const preloadImage = (src) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = resolve;
            img.onerror = reject;
            img.src = src;
        });
    };
});
document.addEventListener('DOMContentLoaded', () => {
    const coverImage = document.getElementById('cover');
    const skeletonWrapper = document.querySelector('.skeleton-wrapper');

    function handleImageLoad() {
        coverImage.classList.add('loaded');
        skeletonWrapper.classList.add('hidden');
    }

    function handleImageChange(newSrc) {
        // Reset states
        coverImage.classList.remove('loaded');
        skeletonWrapper.classList.remove('hidden');

        // Set new image
        coverImage.src = newSrc;

        // Handle loading
        if (coverImage.complete) {
            handleImageLoad();
        } else {
            coverImage.addEventListener('load', handleImageLoad, { once: true });
        }
    }

    // To use when changing songs:
    // handleImageChange('path/to/new/album/cover.jpg');
});

document.addEventListener('DOMContentLoaded', () => {
    const bgContainer = document.querySelector('.background');
    const playerContainer = document.querySelector('.player-img');
    const bgImg = bgContainer.querySelector('img');
    const playerImg = playerContainer.querySelector('img');

    // Load background image
    bgImg.onload = () => {
        bgContainer.classList.add('loaded');
    };

    // Load player image
    playerImg.onload = () => {
        playerContainer.classList.add('loaded');
    };

    // Error handling
    const handleError = (element) => {
        element.parentElement.classList.add('error');
    };

    bgImg.onerror = () => handleError(bgImg);
    playerImg.onerror = () => handleError(playerImg);
});
// Add this to your script.js

// Register service worker and handle updates
function registerAndUpdateServiceWorker() {
    if ('serviceWorker' in navigator) {
      let refreshing = false;
      
      // When the controller changes (new service worker activated)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        console.log('New service worker activated, reloading page for fresh content');
        window.location.reload();
      });
      
      // Register service worker
      navigator.serviceWorker.register('./service-worker.js')
        .then(registration => {
          console.log('ServiceWorker registered successfully');
          
          // Check for updates periodically (every 60 minutes)
          setInterval(() => {
            registration.update()
              .then(() => {
                console.log('Service worker update check completed');
              })
              .catch(err => {
                console.error('Service worker update check failed:', err);
              });
          }, 60 * 60 * 1000);
          
          // Check for waiting service worker
          if (registration.waiting) {
            console.log('New service worker waiting');
            showUpdateUI(registration.waiting);
          }
          
          // Listen for new service workers
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            console.log('New service worker installing');
            
            newWorker.addEventListener('statechange', () => {
              // When the new service worker is installed but waiting
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('New service worker installed and waiting');
                showUpdateUI(newWorker);
              }
            });
          });
          
          // Check current version
          checkServiceWorkerVersion(registration);
        })
        .catch(error => {
          console.error('ServiceWorker registration failed:', error);
        });
    }
  }
  
  // Function to check service worker version
  function checkServiceWorkerVersion(registration) {
    if (!navigator.serviceWorker.controller) {
      console.log('No active service worker found');
      return;
    }
    
    // Create a message channel for the response
    const messageChannel = new MessageChannel();
    
    // Set up message handler
    messageChannel.port1.onmessage = (event) => {
      if (event.data.version) {
        console.log('Current service worker version:', event.data.version);
        
        // Store version in localStorage for comparison
        const storedVersion = localStorage.getItem('swVersion');
        if (storedVersion && storedVersion !== event.data.version) {
          console.log(`Version changed from ${storedVersion} to ${event.data.version}`);
          showNotification('Application updated to version ' + event.data.version, 'info');
        }
        localStorage.setItem('swVersion', event.data.version);
      }
    };
    
    // Send the message
    navigator.serviceWorker.controller.postMessage({
      type: 'CHECK_VERSION'
    }, [messageChannel.port2]);
  }
  
  // Function to show update UI
  function showUpdateUI(worker) {
    // Create update notification with refresh button
    const updateNotification = document.createElement('div');
    updateNotification.className = 'notification update';
    updateNotification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">🔄</span>
        <span class="notification-message">Update available! Refresh to load the latest version.</span>
      </div>
      <button id="update-app-btn" class="notification-btn">Update Now</button>
    `;
    
    document.body.appendChild(updateNotification);
    
    // Add event listener to update button
    document.getElementById('update-app-btn').addEventListener('click', () => {
      // Tell service worker to skip waiting
      worker.postMessage({ type: 'SKIP_WAITING' });
      
      // Hide the notification
      updateNotification.classList.add('fade-out');
      setTimeout(() => {
        updateNotification.remove();
      }, 300);
    });
    
    // Add style for update notification if needed
    if (!document.getElementById('update-notification-style')) {
      const style = document.createElement('style');
      style.id = 'update-notification-style';
      style.textContent = `
        .notification.update {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: #1db954;
          color: white;
          border-radius: 8px;
          padding: 12px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
          z-index: 10000;
          animation: slideIn 0.3s ease-out forwards;
          max-width: 400px;
        }
        
        @keyframes slideIn {
          from { transform: translateY(100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        
        .notification.update.fade-out {
          animation: fadeOut 0.3s ease-in forwards;
        }
        
        @keyframes fadeOut {
          from { transform: translateY(0); opacity: 1; }
          to { transform: translateY(20px); opacity: 0; }
        }
        
        .notification-content {
          display: flex;
          align-items: center;
          margin-right: 16px;
        }
        
        .notification-icon {
          margin-right: 12px;
          font-size: 20px;
        }
        
        .notification-btn {
          background: white;
          color: #1db954;
          border: none;
          padding: 8px 12px;
          border-radius: 4px;
          font-weight: bold;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .notification-btn:hover {
          background: #f0f0f0;
        }
      `;
      document.head.appendChild(style);
    }
  }
  
  // Call this function when the DOM is loaded
  document.addEventListener('DOMContentLoaded', registerAndUpdateServiceWorker);
  
  // Create an offline.html page (optional but recommended)
  function createOfflinePage() {
    if (!navigator.serviceWorker) return;
    
    fetch('/offline.html')
      .catch(() => {
        // Create offline.html if it doesn't exist
        const offlineContent = `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Offline - Music Player</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                padding: 20px;
                background-color: #121212;
                color: white;
                text-align: center;
              }
              
              h1 {
                margin-bottom: 10px;
              }
              
              p {
                margin-bottom: 30px;
                color: #b3b3b3;
              }
              
              button {
                background-color: #1db954;
                color: white;
                border: none;
                border-radius: 30px;
                padding: 12px 30px;
                font-size: 16px;
                cursor: pointer;
                transition: background-color 0.2s;
              }
              
              button:hover {
                background-color: #1ed760;
              }
              
              .offline-icon {
                font-size: 60px;
                margin-bottom: 20px;
              }
            </style>
          </head>
          <body>
            <div class="offline-icon">📡</div>
            <h1>You're offline</h1>
            <p>We can't load the music player right now because you're not connected to the internet.</p>
            <button onclick="window.location.reload()">Try Again</button>
          </body>
          </html>
        `;
        
        // Create a blob from the content
        const blob = new Blob([offlineContent], { type: 'text/html' });
        
        // Use service worker to cache the offline page
        navigator.serviceWorker.ready.then(registration => {
          caches.open(CACHE_NAME).then(cache => {
            const offlineResponse = new Response(blob, { 
              headers: { 'Content-Type': 'text/html' }
            });
            cache.put('/offline.html', offlineResponse);
            console.log('Offline page created and cached');
          });
        });
      });
  }
  
  // Call this function as well
  window.addEventListener('load', createOfflinePage);