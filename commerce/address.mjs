// Apenas o CEP é enviado ao serviço postal. A compra também aceita endereço digitado manualmente.
export async function postalAddress(cep, fetcher=fetch) {
  try {
    const response=await fetcher('https://viacep.com.br/ws/'+cep+'/json/',{
      headers:{Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(3500)
    });
    if(!response.ok) return {found:false,reason:'unavailable'};
    const data=await response.json();
    if(data?.erro===true || data?.erro==='true') return {found:false,reason:'not_found'};
    if(String(data?.cep??'').replace('-','')!==cep || !/^[A-Z]{2}$/.test(data.uf) || typeof data.localidade!=='string') return {found:false,reason:'unavailable'};
    const text=value=>typeof value==='string'?value.slice(0,120):'';
    return {found:true,address:{street:text(data.logradouro),district:text(data.bairro),city:text(data.localidade),uf:data.uf}};
  } catch {
    return {found:false,reason:'unavailable'};
  }
}
