<?php

declare(strict_types=1);

use Nowo\IconSelectorBundle\NowoIconSelectorBundle;
use Nowo\TwigInspectorBundle\NowoTwigInspectorBundle;
use Symfony\Bundle\DebugBundle\DebugBundle;
use Symfony\Bundle\FrameworkBundle\FrameworkBundle;
use Symfony\Bundle\TwigBundle\TwigBundle;
use Symfony\Bundle\WebProfilerBundle\WebProfilerBundle;
use Symfony\UX\Icons\UXIconsBundle;
use Twig\Extra\TwigExtraBundle\TwigExtraBundle;

return [
    FrameworkBundle::class         => ['all' => true],
    TwigBundle::class              => ['all' => true],
    DebugBundle::class             => ['dev' => true],
    WebProfilerBundle::class       => ['dev' => true],
    NowoIconSelectorBundle::class  => ['all' => true],
    NowoTwigInspectorBundle::class => ['dev' => true, 'test' => true],
    UXIconsBundle::class           => ['all' => true],
    TwigExtraBundle::class         => ['all' => true],
];
