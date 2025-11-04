import React, { ReactNode, useState } from 'react';
import Translate, { translate } from '@docusaurus/Translate'
import styles from './styles.module.css';
import posthog from 'posthog-js'
posthog.init('phc_Krs7r8xNYU3OeIItMy5lOoPcTnxJmrX5zYn5JMp2izy', {
  api_host: 'https://feedback-docs.starrocks.io',
  persistence: 'memory',
  autocapture: false,
})

export const Feedback = ({ metadata }: { metadata: any }) => {
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [hoveredScore, setHoveredScore] = useState<Number | null>(null);
  const [textAreaLabel, setTextAreaLabel] = useState<ReactNode | null>(null);
  //const [textAreaPlaceholder, setTextAreaPlaceholder] = useState<string>('This section is optional');
  const [isSubmitSuccess, setIsSubmitSuccess] = useState<boolean>(false);

  const submitDisabled = rating === null || (rating < 4 && (notes === null || notes === ''));

  const scores: (1 | 2 | 3 | 4 | 5)[] = [1, 2, 3, 4, 5];

  const handleSubmit = async () => {
    if (rating === null) {
      setErrorText('Please select a score.');
      return;
    }

    if (rating < 4 && notes === null) {
      setErrorText(
        "Because this doc wasn't perfect, please provide us with some feedback of where we can improve."
      );
      return;
    }

    const sendData = async () => {
      posthog.capture('Feedback', {sentiment: rating + '/5', page: window.location.pathname, text: notes});

    };

    sendData()
      .then(() => {
        setRating(null);
        setNotes(null);
        setIsSubmitSuccess(true);
      })
      .catch(e => {
        console.error(e);
      });

    return;
  };

  const handleScoreClick = (scoreItem: 1 | 2 | 3 | 4 | 5) => {
    if (scoreItem === rating) {
      setRating(null);
      setErrorText(null);
      setHoveredScore(null);
      return;
    }
    setErrorText(null);
    setRating(scoreItem);
    if (scoreItem < 4) {
      setTextAreaLabel(
        <>
          <p><Translate id="feedback.textarealabel.what-can-we-do">What can we do to improve it? Please be as detailed as you like.</Translate></p>
          <p><Translate id="feedback.humans">Real human beings read every single review.</Translate></p>
        </>
      );
      //setTextAreaPlaceholder('<Translate id="feedback.required">This section is required... how can we do better?</Translate>');
    }
    if (scoreItem >= 4) {
      setTextAreaLabel(
        <>
          <p><Translate id="feedback.general">Any general feedback you'd like to add?</Translate></p>
          <p><Translate id="feedback.takeitall">We'll take it all... tell us how well we're doing or where we can improve.</Translate></p>
          <p><Translate id="feedback.humans">Real human beings read every single review.</Translate></p>
        </>
      );
      //setTextAreaPlaceholder('<Translate id="feedback.optional">This section is optional</Translate>');
    }
  };

  // Do not show on Intro page
  if (metadata.source === '@site/docs/index.mdx') {
    return null;
  }

  return (
    <div className={styles.feedback} id={'feedback'}>
      <div className={styles.form}>
        <div className={styles.topSection}>
          <h3><Translate id="feedback.title">What did you think of this doc?</Translate></h3>
          {isSubmitSuccess ? (
            <div className={styles.successMessage}>
              <p><Translate id="feedback.thanks">Thanks for your feedback.</Translate></p>
              <p><Translate id="feedback.community">Connect with the community and devs, links in the top nav!</Translate></p>
            </div>
          ) : (
            <div className={styles.numberRow}>
              {scores.map((star, index) => (
                <div
                  className={styles.star}
                  key={star}
                  onClick={() => handleScoreClick(star)}
                  onMouseEnter={() => setHoveredScore(index + 1)}
                  onMouseLeave={() => setHoveredScore(-1)}
                >
                  {rating >= star ? (
                    <svg width="36" height="36" viewBox="0 0 24 24">
                      <path
                        fill="#ffc107"
                        d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z"
                      />
                    </svg>
                  ) : (
                    <svg width="36" height="36" viewBox="0 0 24 24">
                      <path
                        fill={hoveredScore > index ? '#ffc107' : '#B1BCC7'}
                        d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z"
                      />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={rating ? { display: 'block' } : { display: 'none' }}>
          <div className={styles.textAreaLabel}>{textAreaLabel}</div>
          <textarea
            className={styles.textarea}
            value={notes ?? ''}
            //placeholder={textAreaPlaceholder ?? ''}
            rows={5}
            onChange={e => setNotes(e.target.value)}
          />
          <div className={styles.errorAndButton}>
            <p className={styles.errorText}>{errorText}</p>
            <div className={styles.buttonContainer}>
              <button className={submitDisabled ? styles.buttonDisabled : ''} onClick={() => handleSubmit()}>
                <Translate id="feedback.send">Send your review!</Translate>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}
