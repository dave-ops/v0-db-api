mongodb-crud-service/
├── src/
│   ├── routes/
│   │   └── crud.js
│   ├── controllers/
│   │   └── crudController.js
│   ├── middleware/
│   │   └── validate.js
│   ├── config/
│   │   └── db.js
│   └── server.js
├── .env
├── package.json
└── README.md

## Plex
The Plex app supports deep linking via custom URI schemes to open specific content, such as a movie, on supported platforms (e.g., iOS, Android). The primary scheme is `plex://`, which uses query parameters to specify the server, item, and action. Official documentation is limited, but community reverse-engineering and testing (e.g., from Plex forums) confirm the format works for navigating to and optionally playing a movie's details page.

### General Format to Open a Movie
```
plex://[action]/[server_id]/[metadata_type]/[metadata_id]?[optional_params]
```
- **Scheme**: `plex://` (use `plexapp://` or `plexappext://` for app activation only; these are less flexible).
- **Action** (host part, required): 
  - `resume` or `play` to start/resume playback.
  - `details` (or omit for default view) to open the movie's details page without playing.
- **server_id** (path segment, required for local/remote servers): The machine identifier of your Plex server (a hex string like `ffff1234567890abcdeffedcba0987654321ffff`). Find it via Plex Web App > Settings > Server > General > Show Advanced > [Server ID].
- **metadata_type** (path segment, required): `1` for movies.
- **metadata_id** (path segment, required): The numeric ID of the specific movie (e.g., `5f9b8c4d2e1a3b4c5d6e7f8g`). Retrieve via Plex API (e.g., `http://[PMS_IP]:32400/library/sections/[library_key]/all?X-Plex-Token=[token]`) or XML metadata.
- **Optional parameters** (query string): 
  - `key=[rating_key]`: The full metadata key (e.g., `/library/metadata/12345`) for precision.
  - `X-Plex-Token=[token]`: Your Plex token for authenticated access (generate via Plex Web App or API).

### Example: Open Movie Details Page
To open the details page for a movie with ID `12345` on server `ffff1234567890abcdeffedcba0987654321ffff`:
```
plex://details/ffff1234567890abcdeffedcba0987654321ffff/1/12345
```

### Example: Play a Movie
To immediately play the same movie:
```
plex://play/ffff1234567890abcdeffedcba0987654321ffff/1/12345
```

### Notes
- **Platform support**: Best on iOS/Android Plex apps; test on tvOS/Android TV as support varies. On desktop/web, use `https://app.plex.tv/desktop/#!/provider/[server_id]/[metadata_type]/[metadata_id]?context=[context]` instead.
- **Discovery GUID fallback**: For global (non-server-specific) items, use `plex://movie/[guid]` where `[guid]` is the Plex GUID (e.g., `com.plexapp.agents.themoviedb://tt0111161?lang=en`). This opens in "Discover" mode but may not link to your local library.
- **Troubleshooting**: Ensure the app is installed, signed in, and has server access. URLs must be URL-encoded if embedded (e.g., in HTML links). For automation, integrate with Plex's HTTP API first to fetch IDs/tokens.
- Sources: Derived from Plex iOS deep link analysis on forums (2017) and Reddit discussions (2016–2023), as Plex does not publish full specs.

## Tubi
Tubi is a free, ad-supported streaming service offering thousands of movies, TV shows, and originals across genres like action, horror, comedy, and kids' content. Owned by Fox Corporation, it's available in the US, Canada, Australia, Latin America, and the UK, with apps for iOS, Android, Roku, Fire TV, smart TVs, and web browsers at tubitv.com. No subscription is required—just sign up for a free account to personalize your watchlist and resume playback across devices.

### URI Format to Open a Movie in the Tubi App
Unlike Plex, Tubi's deep linking support is limited and not officially documented for custom URI schemes. Based on available resources (e.g., app store listings and community forums), there isn't a widely confirmed custom scheme like `tubi://` for directly opening specific movies. However, you can achieve similar results using standard web URLs or share links, which the app handles via universal links on iOS/Android:

#### General Format (Web URL or Share Link)
```
https://tubitv.com/[video_type]/[video_id]?start=true&track=[optional_tracking]
```
- **video_type**: `movie` for films or `series` for TV shows (e.g., `movie`).
- **video_id**: The numeric ID of the movie (e.g., `12345`). Find it by browsing tubitv.com, right-clicking a title's play button, and inspecting the URL, or via the app's share feature.
- **Optional params**:
  - `start=true`: Attempts to auto-start playback (app-dependent).
  - `track=...`: Referral or campaign tracking (ignore for personal use).
- On mobile: Tapping this URL in a browser or message will prompt to open in the Tubi app if installed (via universal links). If not, it loads in the web view.

#### Example: Open Movie Details or Play
For the movie *The Matrix* (ID example: 12345):
```
https://tubitv.com/movie/12345
```
- This opens the details page in the app (or web).
- To play: Append `?start=true` → `https://tubitv.com/movie/12345?start=true`.

#### Share Feature (Easiest for Specific Content)
1. Open the Tubi app.
2. Navigate to a movie's details page.
3. Tap the **Share** button (usually an icon with arrows).
4. Select a method (e.g., Messages, email, or copy link). The generated URL follows the format above and can be used to deep-link back to that movie on another device.

### Notes
- **Platform Support**: Works best on iOS/Android for app switching; on TV platforms like Roku, use the app's search or voice remote. No confirmed custom scheme like `tubi://play/...` exists in public docs or forums.
- **Limitations**: Tubi doesn't support offline downloads natively (only streaming), and ads play during content. For IDs, use the web version or app share to extract them.
- **Alternatives**: If you need programmatic access, Tubi's API is private—contact their support for partnerships. For similar free services, check Pluto TV or Crackle.

If this isn't what you meant by "tubi?" (e.g., comparing to Plex or something else), provide more details!