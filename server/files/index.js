import { ButtonBuilder, ElementBuilder, MovieBuilder } from "./builders.js";

const messages = {
  dataLoadError: 'Failed to load data, status',
  movieAlreadyInCollection: 'Movie is already in the collection.',
  addMovieFailed: 'Failed to add the movie.',
  deleteMovieFailed: 'Film konnte nicht gelöscht werden.',
  noResultsFound: 'No results found.',
  searchFailed: 'The search failed...',
  loggedOutGreeting: 'Please log in to view your movie collection.',
  loginFailed: 'Login failed'
};

let currentSession = null;

function updateGenres() {
  const header = document.querySelector('nav>h2');
  const listElement = document.querySelector("#filter");
  listElement.innerHTML = '';

  if (!currentSession) {
    header.style.display = 'none';
    listElement.style.display = 'none';
    return;
  }

  fetch("/genres")
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(genres => {
      header.style.display = 'block';
      listElement.style.display = 'flex';
      new ElementBuilder("li").append(new ButtonBuilder("All").onclick(() => loadMovies()))
        .appendTo(listElement);

      for (const genre of genres) {
        new ElementBuilder("li").append(new ButtonBuilder(genre).onclick(() => loadMovies(genre)))
          .appendTo(listElement);
      }

      const firstButton = listElement.querySelector("button");
      if (firstButton) firstButton.click();
    })
    .catch(error => {
      console.error('Failed to load genres:', error);
      listElement.append(`${messages.dataLoadError} ${error.message}`);
    });
}

function removeMovies() {
  const mainElement = document.querySelector("main");
  while (mainElement.childElementCount > 0) {
    mainElement.firstChild.remove();
  }
}

function loadMovies(genre) {
  const url = new URL("/movies", location.href);
  if (genre) url.searchParams.set("genre", genre);

  fetch(url)
    .then(response => {
      removeMovies();
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(movies => {
      const mainElement = document.querySelector("main");
      // Safety: Turn object into array
      const movieList = Array.isArray(movies) ? movies : Object.values(movies || {});

      movieList.forEach(movie => {
        // THE FIX: Only try to draw the movie if Genres exists
        if (movie && movie.Genres && Array.isArray(movie.Genres)) {
          new MovieBuilder(movie, deleteMovie, Boolean(currentSession)).appendTo(mainElement);
        } else {
          console.warn("Skipping broken movie data for:", movie.Title);
        }
      });
    })
    .catch(error => {
      console.error('Failed to load movies:', error);
      const mainElement = document.querySelector("main");
      mainElement.append(`${messages.dataLoadError}: ${error.message}`);
    });
}

function addMovie(imdbID) {
  fetch(`/movies/${imdbID}`, { method: 'PUT' })
    .then(response => {
      if (response.status === 201 || response.status === 200) {
        
        const searchResultItem = document.getElementById(`search-${imdbID}`);
        if (searchResultItem) {
          searchResultItem.remove();
        }
    
        loadMovies();
        updateGenres();
        
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    })
    .catch(error => {
      console.error('Failed to add movie:', error);
      alert(messages.addMovieFailed);
    });
}

function deleteMovie(imdbID) {
  fetch(`/movies/${imdbID}`, { method: 'DELETE' })
    .then(response => {
      if (response.ok) {
        const article = document.getElementById(imdbID);
        if (article) article.remove();
        updateGenres();
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    })
    .catch(error => {
      console.error('Failed to delete movie:', error);
      alert(messages.deleteMovieFailed);
    });
}

function searchMovies(query) {
  const resultsDiv = document.getElementById("searchResults");
  resultsDiv.innerHTML = 'Searching...'; 

  fetch(`/search?query=${encodeURIComponent(query)}`)
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(results => {
      resultsDiv.innerHTML = ''; 

      if (!results || results.length === 0) {
        resultsDiv.textContent = messages.noResultsFound;
        return;
      }

      // Task 2.2: Render results using ONLY commands we know work
      results.forEach(movie => {
        const movieRow = new ElementBuilder("div");
        movieRow.id(`search-${movie.imdbID}`);
        movieRow.appendTo(resultsDiv);

        // Add the Title and Year
        movieRow.append(
          new ElementBuilder("span").text(`${movie.Title} (${movie.Year}) `)
        );

        // Add the Add button
        movieRow.append(
          new ButtonBuilder("Add").onclick(() => addMovie(movie.imdbID))
        );
      });
    })
    .catch(error => {
      console.error('Search rendering failed:', error);
      resultsDiv.innerHTML = '';
      new ElementBuilder("p")
        .text(messages.searchFailed)
        .appendTo(resultsDiv);
    });
}

window.onload = function () {
  fetch("/session")
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(data => {
      currentSession = data || null;
      updateUI();
    })
    .catch(error => {
      console.error('Failed to load session:', error);
      currentSession = null;
      updateUI();
    });

  function renderUserGreeting() {
    const greetingElement = document.getElementById('userGreeting');
    if (currentSession) {
      const loginDate = new Date(currentSession.loginTime); 
      const dateString = loginDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const timeString = loginDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      greetingElement.textContent = `Hi ${currentSession.firstName} ${currentSession.lastName}, you logged in on ${dateString} at ${timeString}.`;
    } else {
      greetingElement.textContent = messages.loggedOutGreeting;
    }
  }

  function updateUI() {
    const authBtn = document.getElementById('authBtn');
    const addMoviesBtn = document.getElementById('addMoviesBtn');

    renderUserGreeting();
    updateGenres();

    if (currentSession) {
      authBtn.textContent = 'Logout';
      authBtn.onclick = () => {
        fetch("/logout").then(response => {
          if (response.ok) {
            currentSession = null;
            updateUI();
          }
        });
      };
      addMoviesBtn.style.display = 'inline';
    } else {
      removeMovies();
      authBtn.textContent = 'Login';
      authBtn.onclick = () => {
        document.getElementById('loginForm').reset();
        document.getElementById('loginDialog').showModal();
      };
      addMoviesBtn.style.display = 'none';
    }
  }

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const username = formData.get('username');
    const password = formData.get('password');

    try {
      const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }) 
      });

      if (response.ok) {
        currentSession = await response.json();
        document.getElementById('loginDialog').close();
        updateUI();
        loadMovies();
      } else {
        alert(messages.loginFailed);
      }
    } catch (error) {
      console.error("Login error:", error);
    }
  });

  document.getElementById('cancelLogin').addEventListener('click', () => {
    document.getElementById('loginDialog').close();
  });

  document.getElementById('addMoviesBtn').addEventListener('click', () => {
    document.getElementById('searchForm').reset();
    document.getElementById('searchResults').innerHTML = '';
    document.getElementById('searchDialog').showModal();
  });

  document.getElementById('searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    searchMovies(document.getElementById('query').value);
  });

  document.getElementById('cancelSearch').addEventListener('click', () => {
    document.getElementById('searchDialog').close();
  });
};