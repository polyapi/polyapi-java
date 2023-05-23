import Axios from 'axios';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { POLY_HEADER_API_KEY } from './constants';
import { Specification } from '@poly/common';
import dotenv from 'dotenv';

dotenv.config();

const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy || process.env.npm_config_proxy;
const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.npm_config_https_proxy;

const axios = Axios.create({
  httpAgent: httpProxy ? new HttpProxyAgent(httpProxy) : undefined,
  httpsAgent: httpsProxy
    ? new HttpsProxyAgent(httpsProxy, {
        rejectUnauthorized: process.env.NODE_ENV !== 'development',
      })
    : undefined,
  proxy: false,
});

export const getSpecs = async (contexts?: string[], names?: string[], ids?: string[]) => {
  return (
    await axios.get<Specification[]>(`${process.env.POLY_API_BASE_URL}/specs`, {
      headers: {
        [POLY_HEADER_API_KEY]: process.env.POLY_API_KEY || '',
      },
      params: {
        contexts,
        names,
        ids,
      },
    })
  ).data;
};

export const createServerFunction = async (context: string | null, name: string, code: string) => {
  return (
    await axios.post(
      `${process.env.POLY_API_BASE_URL}/functions/server`,
      {
        context,
        name,
        code,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          [POLY_HEADER_API_KEY]: process.env.POLY_API_KEY || '',
        },
      },
    )
  ).data;
};

export const createClientFunction = async (context: string | null, name: string, code: string) => {
  return (
    await axios.post(
      `${process.env.POLY_API_BASE_URL}/functions/client`,
      {
        context,
        name,
        code,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          [POLY_HEADER_API_KEY]: process.env.POLY_API_KEY || '',
        },
      },
    )
  ).data;
};
