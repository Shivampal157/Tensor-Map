const ITEMS = [
  {
    icon: '🧠',
    title: 'MNIST feedforward',
    badge: 'Starter',
    desc: 'Input → Flatten → Dense(10, softmax). Dataset: MNIST.',
    tags: ['mnist', 'dense'],
  },
  {
    icon: '🖼️',
    title: 'CNN starter',
    badge: 'Conv',
    desc: 'Input → Conv2D → Pool → Dense. Try CIFAR-10.',
    tags: ['conv2d', 'images'],
  },
  {
    icon: '📈',
    title: 'Sequence',
    badge: 'RNN',
    desc: 'LSTM/GRU after reshaping inputs for sequences.',
    tags: ['lstm', 'gru'],
  },
];

export function TemplateStrip() {
  return (
    <div className="template-strip-block">
      <div className="template-strip-title">Model templates</div>
      <div className="template-grid">
        {ITEMS.map((t) => (
          <article key={t.title} className="template-card">
            <div className="template-card-icon" aria-hidden>
              {t.icon}
            </div>
            <h4>{t.title}</h4>
            <span className="template-badge">{t.badge}</span>
            <p>{t.desc}</p>
            <div className="template-tags">
              {t.tags.map((tag, i) => (
                <span key={tag} className={i === 0 ? 'template-tag teal' : 'template-tag'}>
                  {tag}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
