const axios = require("axios");

module.exports = {
  config: {
    name: "anilist",
    description: "Search anime/manga info or AniList user profile",
    author: "anbuinfosec",
    category: "anime",
    role: 0,
    guide: "{pn}anilist naruto\n{pn}anilist -u anbuinfosec"
  },

  onCmd: async ({ args, reply }) => {
    const query = args.join(" ");
    const isUser = args.includes("-u");

    if (!query) return reply("❌ Please provide an anime/manga name or `-u <username>`.");

    if (isUser) {
      const username = args[args.indexOf("-u") + 1];
      if (!username) return reply("❌ Please provide a username after `-u`");

      const userQuery = `
        query {
          User(name: "${username}") {
            id
            name
            about
            siteUrl
            avatar { large }
            statistics {
              anime {
                count
                episodesWatched
                minutesWatched
                meanScore
              }
              manga {
                count
                chaptersRead
                volumesRead
                meanScore
              }
            }
          }
        }
      `;

      try {
        const res = await axios.post("https://graphql.anilist.co", {
          query: userQuery
        }, { headers: { "Content-Type": "application/json" } });

        const user = res.data.data.User;
        const about = user.about ? user.about.replace(/<br>/g, "\n") : "No description available.";

        const caption = `
👤 ${user.name}
🔗 AniList: ${user.siteUrl}

📖 About: ${about.slice(0, 300)}${about.length > 300 ? "..." : ""}

📺 Anime Stats:
•⁠ Watched: ${user.statistics.anime.count}
•⁠ Episodes Watched: ${user.statistics.anime.episodesWatched}
•⁠ Mean Score: ${user.statistics.anime.meanScore}
•⁠ Minutes Watched: ${user.statistics.anime.minutesWatched}

📚 Manga Stats:
•⁠ Read: ${user.statistics.manga.count}
•⁠ Chapters Read: ${user.statistics.manga.chaptersRead}
•⁠ Volumes Read: ${user.statistics.manga.volumesRead}
•⁠ Mean Score: ${user.statistics.manga.meanScore || "N/A"}
`;

        const img = (await axios.get(user.avatar.large, { responseType: "arraybuffer" })).data;
        return await reply({
          image: Buffer.from(img),
          mimetype: "image/jpeg",
          caption
        });
      } catch (err) {
        console.error("AniList API error:", err.response?.data || err.message);
        return reply("❌ Could not fetch AniList user profile.");
      }
    } else {
      const searchQuery = `
        query {
          Media(search: "${query}", type: ANIME) {
            title { romaji english native }
            episodes
            siteUrl
            genres
            averageScore
            description(asHtml: false)
            coverImage { large }
          }
        }
      `;

      try {
        const res = await axios.post("https://graphql.anilist.co", {
          query: searchQuery
        }, { headers: { "Content-Type": "application/json" } });

        const media = res.data.data.Media;
        const caption = `
🎬 ${media.title.english || media.title.romaji}
📺 Episodes: ${media.episodes || "?"}
⭐ Score: ${media.averageScore || "?"}
🎭 Genres: ${media.genres.join(", ")}

${media.description.slice(0, 500)}${media.description.length > 500 ? "..." : ""}

🔗 More info: ${media.siteUrl}
`;

        const img = (await axios.get(media.coverImage.large, { responseType: "arraybuffer" })).data;
        return await reply({
          image: Buffer.from(img),
          mimetype: "image/jpeg",
          caption
        });
      } catch (err) {
        console.error("AniList API error:", err.response?.data || err.message);
        return reply("❌ Could not fetch anime info.");
      }
    }
  }
};
