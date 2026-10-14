/** Decide, antes da primeira pintura, se a abertura (Splash.tsx) toca: marca <html data-splash="off"> quando deve pular. */
export const SPLASH_GATE = `(function(){try{var d=document.documentElement,p=location.pathname,f=/[?&]splash=1/.test(location.search);
if(f){return}
if(sessionStorage.getItem('fz_splash')||p==='/'||p.indexOf('/termos')===0||p==='/privacidade'||p.indexOf('/admin')===0||navigator.webdriver||matchMedia('(prefers-reduced-motion: reduce)').matches){d.setAttribute('data-splash','off')}
}catch(e){}})();`;
