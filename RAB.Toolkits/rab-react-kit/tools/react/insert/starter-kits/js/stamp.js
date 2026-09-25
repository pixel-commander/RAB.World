// stamp.js — template stamping helpers; every component and page builds
// by cloning an inert <template> and filling data-slot targets

export const stamp = (templateId) => {
  const template = document.getElementById(templateId);
  return template.content.cloneNode(true);
};

export const slot = (fragment, name) => fragment.querySelector(`[data-slot="${name}"]`);

export const fill = (fragment, values) => {
  Object.entries(values).forEach(([name, value]) => {
    const target = slot(fragment, name);
    if (value instanceof Node) {
      target.replaceChildren(value);
      return;
    }
    target.textContent = value;
  });
  return fragment;
};

export const cell = (area) => document.querySelector(`[data-area="${area}"] > .inner`);

// a manifest component whose module exports buildDemo() demos live;
// otherwise its static tpl-demo-<name> exemplar stamps
export const demo = async (component) => {
  if (component.js) {
    const module = await import(`../components/${component.path}/js/${component.name}.js`);
    if (module.buildDemo) {
      return module.buildDemo();
    }
  }
  return stamp(`tpl-demo-${component.name}`);
};
