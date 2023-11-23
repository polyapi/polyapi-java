import { CustomObjectsApi, KubeConfig, CoreV1Api } from '@kubernetes/client-node';
import { Logger } from '@nestjs/common';

const logger = new Logger('KubernetesClient');

export const getApiClient = (): {
  customObjectsApi: CustomObjectsApi,
  v1Api: CoreV1Api
} => {
  const kc = new KubeConfig();

  if (process.env.KUBE_CONFIG_USE_DEFAULT === 'true') {
    logger.debug('Loading Kubernetes config from default location...');
    kc.loadFromDefault();
  } else if (process.env.KUBE_CONFIG_FILE_PATH) {
    logger.debug(`Loading Kubernetes config from ${process.env.KUBE_CONFIG_FILE_PATH}...`);
    kc.loadFromFile(process.env.KUBE_CONFIG_FILE_PATH);
  } else {
    logger.debug('Loading Kubernetes config from cluster...');
    kc.loadFromCluster();
  }

  return {
    customObjectsApi: kc.makeApiClient(CustomObjectsApi),
    v1Api: kc.makeApiClient(CoreV1Api),
  };
};
