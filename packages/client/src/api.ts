import Axios, { AxiosResponse } from 'axios';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import https from 'https';
import dotenv from 'dotenv';
import { FunctionDetailsDto, Specification } from '@poly/model';

dotenv.config();

const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy || process.env.npm_config_proxy;
const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.npm_config_https_proxy;
const nodeEnv = process.env.NODE_ENV;

const axios = Axios.create({
  httpAgent: httpProxy
    ? new HttpProxyAgent(httpProxy)
    : undefined,
  httpsAgent: httpsProxy
    ? new HttpsProxyAgent(httpsProxy, {
      rejectUnauthorized: nodeEnv !== 'development',
    })
    : nodeEnv === 'development'
      ? new https.Agent({ rejectUnauthorized: false })
      : undefined,
  proxy: false,
});

export const getSpecs = async (contexts?: string[], names?: string[], ids?: string[]) => {
  return (
    await axios.get<Specification[]>(`${process.env.POLY_API_BASE_URL}/specs`, {
      headers: {
        Authorization: `Bearer ${process.env.POLY_API_KEY || ''}`,
      },
      params: {
        contexts,
        names,
        ids,
      },
    })
  ).data;
};

export const createServerFunction = async (
  context: string | null,
  name: string,
  description: string | null,
  code: string,
) => {
  return (
    await axios.post<any, AxiosResponse<FunctionDetailsDto>>(
      `${process.env.POLY_API_BASE_URL}/functions/server`,
      {
        context,
        name,
        description,
        code,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.POLY_API_KEY || ''}`,
        },
      },
    )
  ).data;
};

export const createClientFunction = async (
  context: string | null,
  name: string,
  description: string | null,
  code: string,
) => {
  return (
    await axios.post<any, AxiosResponse<FunctionDetailsDto>>(
      `${process.env.POLY_API_BASE_URL}/functions/client`,
      {
        context,
        name,
        description,
        code,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.POLY_API_KEY || ''}`,
        },
      },
    )
  ).data;
};
