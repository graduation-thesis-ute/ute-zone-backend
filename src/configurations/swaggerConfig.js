import swaggerJsDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import "dotenv/config.js";

const swaggerOptions = {
  swaggerDefinition: {
    openapi: "3.0.0",
    info: {
      title: "UTEZONE API Documentation",
      version: "1.0.0",
      description: "API documentation for the UTEZONE Application",
      contact: {
        name: "API Support",
        email: "vohuutai2369@gmail.com",
      },
    },
    servers: [
      //   {
      //     // url: `realtime-chat-app-api-tbaf.onrender.com`,
      //     description: "Remote server",
      //   },
      {
        url: `http://localhost:${process.env.PORT}`,
        description: "Local server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ["src/docs/*.js"],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
export { swaggerUi, swaggerDocs };
