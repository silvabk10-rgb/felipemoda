export async function commerceRequest(payload,{signal}={}) {
  let response;
  try {
    response=await fetch('/.netlify/functions/commerce',{
      method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},
      cache:'no-store',credentials:'same-origin',body:JSON.stringify(payload),signal
    });
  } catch(error) {
    if(error.name==='AbortError') throw error;
    throw new Error('A conexão falhou. Confira sua internet e tente novamente.');
  }
  const data=await response.json().catch(()=>null);
  if(!response.ok || !data?.ok){
    const error=new Error(data?.message || 'O serviço está indisponível no momento. Tente novamente.');
    error.status=response.status;error.code=data?.code;
    error.order=data?.orderToken ? data : null;
    throw error;
  }
  return data;
}
