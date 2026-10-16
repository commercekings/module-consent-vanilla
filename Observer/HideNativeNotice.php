<?php
declare(strict_types=1);

namespace CommerceKings\ConsentVanilla\Observer;

use CommerceKings\ConsentVanilla\ViewModel\Banner;
use Magento\Framework\Event\Observer;
use Magento\Framework\Event\ObserverInterface;
use Magento\Framework\View\LayoutInterface;

/** Replace the native notice only in a Hyvä store displaying the selected Vanilla source. */
class HideNativeNotice implements ObserverInterface
{
    public function __construct(private readonly Banner $banner)
    {
    }

    public function execute(Observer $observer): void
    {
        $layout = $observer->getData('layout');
        if (!$layout instanceof LayoutInterface
            || !in_array('hyva_default', $layout->getUpdate()->getHandles(), true)
            || !$this->banner->isEnabled()
        ) {
            return;
        }
        $layout->unsetElement('cookie_notices');
    }
}
