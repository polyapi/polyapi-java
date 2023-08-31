import Axios, { AxiosResponse } from 'axios';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import https from 'https';
import dotenv from 'dotenv';
import { FunctionDetailsDto, SignUpDto, SignUpVerificationResultDto, Specification, TosDto } from '@poly/model';
import { getInstanceUrl } from '@poly/common/utils';

dotenv.config();

const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy || process.env.npm_config_proxy;
const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.npm_config_https_proxy;
const nodeEnv = process.env.NODE_ENV;
const isDevEnv = nodeEnv === 'development';

const getApiBaseURL = () => {
  if (isDevEnv) {
    return process.env.POLY_API_BASE_URL;
  } else {
    return process.env.POLY_API_BASE_URL.replace(/^http:/, 'https://');
  }
};

const axios = Axios.create({
  httpAgent: httpProxy
    ? new HttpProxyAgent(httpProxy)
    : undefined,
  httpsAgent: httpsProxy
    ? new HttpsProxyAgent(httpsProxy, {
      rejectUnauthorized: !isDevEnv,
    })
    : isDevEnv
      ? new https.Agent({ rejectUnauthorized: false })
      : undefined,
  proxy: false,
});

export const getSpecs = async (contexts?: string[], names?: string[], ids?: string[]) => {
  return (
    await axios.get<Specification[]>(`${getApiBaseURL()}/specs`, {
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
      `${getApiBaseURL()}/functions/server`,
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
      `${getApiBaseURL()}/functions/client`,
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

export const createTenantSignUp = async (instance: string, email: string, tenantName: string | null = null) => {
  return (
    await axios.post<any, AxiosResponse<SignUpDto>>(`${getInstanceUrl(instance)}/tenants/sign-up`, {
      email,
      tenantName,
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
    })
  ).data;
};

export const verifyTenantSignUp = async (instance: string, email: string, code: string) => {
  return (
    await axios.post<any, AxiosResponse<SignUpVerificationResultDto>>(`${getInstanceUrl(instance)}/tenants/sign-up/verify`, {
      code,
      email,
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
    })
  ).data;
};

export const resendVerificationCode = (instance: string, email: string) => {
  return axios.post<any, AxiosResponse<SignUpDto>>(`${getInstanceUrl(instance)}/tenants/sign-up/resend-verification-code`, {
    email,
  });
};

export const getLastTos = async (instance: string) => {
  return (await axios.get<any, AxiosResponse<TosDto>>(`${getInstanceUrl(instance)}/tos`)).data;
};
