import axios, { AxiosResponse } from 'axios';
import { POLY_HEADER_API_KEY } from './constants';
import { FunctionDetailsDto, Specification } from '@poly/common';

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
          [POLY_HEADER_API_KEY]: process.env.POLY_API_KEY || '',
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
          [POLY_HEADER_API_KEY]: process.env.POLY_API_KEY || '',
        },
      },
    )
  ).data;
};
