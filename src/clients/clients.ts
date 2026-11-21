import { HttpsProxyAgent } from "https-proxy-agent";
import { config } from "../config/env.js";
import axios from "axios";

export const fixieAgent = config.proxy.fixieUrl
    ? new HttpsProxyAgent(config.proxy.fixieUrl)
    : undefined;


export const fatSecretClient = axios.create({
    baseURL: "https://platform.fatsecret.com",
    timeout: 10000,
    httpsAgent: fixieAgent,
    proxy: false
});

