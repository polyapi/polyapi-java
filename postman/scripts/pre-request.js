const { headers, body, auth, url } = pm.request;

pm.environment.set('templateHeaders', headers);
pm.environment.set('templateBody', body);
pm.environment.set('templateAuth', auth);
pm.environment.set('templateUrl', url);

