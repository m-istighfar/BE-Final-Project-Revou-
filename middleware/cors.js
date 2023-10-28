const cors = require("cors");

module.exports = (app) => {
  const allowedOrigins = [
    "http://localhost:5173",
    "https://clinquant-nougat-f52198.netlify.app",
    "https://try--clinquant-nougat-f52198.netlify.app",
    "https://candid-chaja-157afe.netlify.app",
  ];

  const corsOptions = {
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
  };

  app.use(cors(corsOptions));
};
